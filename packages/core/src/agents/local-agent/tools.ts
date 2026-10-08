// The local agent's tools (local-llm-codes-in-process, ADR 0038 decision 3).
//
// Ported from `coding-agent`, fewer of them: reading, writing, replacing in
// a file, listing, searching, and running a command. Git, background
// processes, delete and move are left to `run_command`; fewer tools leave a
// model less to choose wrongly among. Every path goes through
// `resolveInside`, so nothing outside the run's working directory is read
// or written.

import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { terminateProcessTree } from "../shared.js";
import { resolveInside } from "./sandbox.js";
import { runWebResearchTool, WEB_RESEARCH_TOOL_SCHEMAS, type WebResearchOptions } from "../../web-research.js";

export interface ToolLimits {
  /** Seconds a command may run before it is ended. */
  commandTimeoutSeconds: number;
  /** Characters of a command's output, or a search's, the model is given. */
  maxCommandOutputChars: number;
}

export const DEFAULT_TOOL_LIMITS: ToolLimits = { commandTimeoutSeconds: 60, maxCommandOutputChars: 12_000 };

/** The OpenAI function schema of a tool. */
export interface ToolSchema {
  type: "function";
  function: { name: string; description: string; parameters: { type: "object"; properties: Record<string, { type: string; items?: { type: string } }>; required: string[] } };
}

function schema(name: string, description: string, properties: ToolSchema["function"]["parameters"]["properties"], required: string[]): ToolSchema {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required } } };
}

export const TOOL_SCHEMAS: readonly ToolSchema[] = [
  schema("read_file", "Read a UTF-8 text file in the working directory.", { path: { type: "string" } }, ["path"]),
  schema(
    "write_file",
    "Write a UTF-8 text file in the working directory, creating its directories.",
    { path: { type: "string" }, content: { type: "string" } },
    ["path", "content"],
  ),
  schema(
    "replace_text",
    "Replace old_text with new_text in a file; expected_replacements must equal the number of occurrences.",
    { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" }, expected_replacements: { type: "integer" } },
    ["path", "old_text", "new_text"],
  ),
  schema("list_dir", "List a directory in the working directory.", { path: { type: "string" } }, []),
  schema(
    "search_text",
    "Search for a literal text in the files under a directory of the working directory.",
    { query: { type: "string" }, path: { type: "string" } },
    ["query"],
  ),
  schema(
    "run_command",
    "Run a shell command in the working directory and return its exit code and output.",
    { command: { type: "string" } },
    ["command"],
  ),
  ...WEB_RESEARCH_TOOL_SCHEMAS,
  // A decision the change's files do not make is the operator's: asked,
  // waited for, and answered as the tool's result (the-agent-asks-the-operator,
  // ADR 0042 decision 4). Run by the loop, not by `runTool`.
  schema(
    "ask_operator",
    "Ask the operator a question that the change's files and your instructions do not settle, and wait for the answer, which is returned. Ask only what you cannot decide from the files.",
    { question: { type: "string" } },
    ["question"],
  ),
];

/** Each tool's parameters with their JSON types, for reading calls written
 * as text. */
export const TOOL_PARAMETER_TYPES: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map(
  TOOL_SCHEMAS.map((tool) => [
    tool.function.name,
    Object.fromEntries(Object.entries(tool.function.parameters.properties).map(([key, value]) => [key, value.type])),
  ]),
);

/** A tool's answer; `failed` says it did not do what was asked. */
export interface ToolResult {
  output: string;
  failed: boolean;
}

function text(args: Record<string, unknown>, key: string, fallback?: string): string {
  const value = args[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (fallback !== undefined) return fallback;
  throw new Error(`missing argument "${key}"`);
}

function cap(output: string, limit: number): string {
  if (output.length <= limit) return output;
  return `${output.slice(0, limit)}\n... (${output.length - limit} more characters)`;
}

const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", ".venv", "dist", "out", ".openspec-ui"]);

async function* filesUnder(directory: string): AsyncGenerator<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) yield* filesUnder(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/** Runs `command` through the platform's shell in `cwd`, ending it, and
 * every process it started, at the time limit or when `signal` aborts. */
export function runShellCommand(command: string, cwd: string, limits: ToolLimits, signal?: AbortSignal): Promise<ToolResult> {
  return new Promise((resolve) => {
    // The shell reads the command line as a person would type it; the
    // command is the model's, which is why it runs only in `cwd` and only
    // for as long as the limit allows.
    const child = spawn(command, { cwd, shell: true, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, ...(process.platform !== "win32" ? { detached: true } : {}) });
    let output = "";
    let ended: string | undefined;
    const end = (why: string) => {
      ended = why;
      if (child.pid !== undefined) void terminateProcessTree(child.pid);
    };
    const timer = setTimeout(() => end(`ended after ${limits.commandTimeoutSeconds} s`), limits.commandTimeoutSeconds * 1000);
    const onAbort = () => end("ended: the run was cancelled");
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
    child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
    const finish = (code: number | null, error?: Error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      const head = error ? `Could not run the command: ${error.message}` : ended ? `The command was ${ended}.` : `Exit code ${code ?? "unknown"}.`;
      resolve({ output: cap(`${head}\n${output}`.trimEnd(), limits.maxCommandOutputChars), failed: error !== undefined || ended !== undefined || code !== 0 });
    };
    child.on("error", (error) => finish(null, error));
    child.on("close", (code) => finish(code));
  });
}

/** Runs one tool in `cwd`. A refused path, a missing argument or an
 * unknown tool is an answer, not an exception: the model is told and
 * goes on. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  cwd: string,
  limits: ToolLimits,
  signal?: AbortSignal,
  webResearch?: WebResearchOptions,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "search_web":
      case "fetch_webpage":
        return webResearch
          ? await runWebResearchTool(name, args, webResearch, signal)
          : { output: "Web research is unavailable in this run.", failed: true };
      case "read_file": {
        const target = await resolveInside(cwd, text(args, "path"));
        return { output: cap(await readFile(target, "utf8"), limits.maxCommandOutputChars * 4), failed: false };
      }
      case "write_file": {
        const requested = text(args, "path");
        const target = await resolveInside(cwd, requested);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, text(args, "content"), "utf8");
        return { output: `Wrote ${requested}`, failed: false };
      }
      case "replace_text": {
        const requested = text(args, "path");
        const target = await resolveInside(cwd, requested);
        const oldText = text(args, "old_text");
        if (oldText.length === 0) return { output: "old_text is empty", failed: true };
        const content = await readFile(target, "utf8");
        const count = content.split(oldText).length - 1;
        const expected = args.expected_replacements === undefined ? 1 : Number(args.expected_replacements);
        if (count !== expected) {
          return { output: `Expected ${expected} occurrence(s) of old_text in ${requested}, found ${count}; nothing replaced`, failed: true };
        }
        await writeFile(target, content.split(oldText).join(text(args, "new_text")), "utf8");
        return { output: `Replaced ${count} occurrence(s) in ${requested}`, failed: false };
      }
      case "list_dir": {
        const requested = text(args, "path", ".");
        const target = await resolveInside(cwd, requested);
        const entries = await readdir(target, { withFileTypes: true });
        const lines = entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name)).sort();
        return { output: lines.join("\n") || "(empty)", failed: false };
      }
      case "search_text": {
        const query = text(args, "query");
        const target = await resolveInside(cwd, text(args, "path", "."));
        const found: string[] = [];
        const roots = (await stat(target)).isDirectory() ? filesUnder(target) : (async function* () { yield target; })();
        for await (const file of roots) {
          let content: string;
          try {
            content = await readFile(file, "utf8");
          } catch {
            continue;
          }
          content.split(/\r?\n/u).forEach((line, index) => {
            if (line.includes(query)) found.push(`${path.relative(cwd, file).split(path.sep).join("/")}:${index + 1}: ${line.trim()}`);
          });
          if (found.length >= 200) break;
        }
        return { output: cap(found.join("\n") || "No match.", limits.maxCommandOutputChars), failed: false };
      }
      case "run_command":
        return await runShellCommand(text(args, "command"), cwd, limits, signal);
      default:
        return { output: `Unknown tool: ${name}`, failed: true };
    }
  } catch (error) {
    return { output: `Tool error: ${error instanceof Error ? error.message : String(error)}`, failed: true };
  }
}
