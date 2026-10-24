// Adapter: Codex CLI (`codex`). Non-interactive mode (`exec`), the prompt
// is fed in via stdin (see claude.ts for the same pattern).
//
// codex-cli-is-a-full-agent (ADR 0051): three things this adapter did not
// say, which a trial run on codex-cli 0.164.0 showed mattered.
// - The sandbox. Told nothing, `codex exec` ran read-only: an apply stage
//   wrote no file, the agent said "this workspace is read-only", and the
//   process exited 0. Each command now names its sandbox: `workspace-write`
//   for a stage that writes the change, `read-only` for one that reads.
//   `danger-full-access` is never named, and the allowlist refuses it.
// - Its events. `--json` streams one event per line - the agent's
//   messages, each command it ran and its exit code, the turn's usage, a
//   failed turn - where plain text gave only the prose. They are told here
//   as the prose a run log reads, and the usage is reported.
// - The model, through `--model`.

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { AgentUsage } from "../agent-usage.js";
import { say } from "../message-register.js";
import type { Command, CommandKind, Event } from "../protocol.js";
import { commandInstruction, spawnAndStream } from "./shared.js";

/** The sandboxes this product runs codex in. */
export type CodexSandbox = "read-only" | "workspace-write";
export const CODEX_SANDBOXES: readonly CodexSandbox[] = ["read-only", "workspace-write"];

/** The commands whose stage writes the change: its plan, its code, its
 * revised plan, and verify, whose checks build and write caches. Every
 * other command reads (ADR 0051). */
const WRITING_KINDS: ReadonlySet<CommandKind> = new Set<CommandKind>(["plan", "implement", "update", "verify"]);

export function codexSandboxFor(kind: CommandKind): CodexSandbox {
  return WRITING_KINDS.has(kind) ? "workspace-write" : "read-only";
}

/** How much of a failed command's output a run log is told. */
const FAILED_OUTPUT_LINES = 10;

/** What one line of `codex exec --json` says, for a run log and the run's
 * events; `undefined` for a line that says nothing worth telling. */
export type CodexLine =
  | { kind: "text"; text: string }
  | { kind: "usage"; usage: AgentUsage }
  | { kind: "failure"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** The usage a turn reported. Codex counts cached input inside its input
 * tokens; here they are apart, as the other agents report them, so a
 * budget never counts them twice. */
export function codexUsage(raw: unknown): AgentUsage | undefined {
  if (!isRecord(raw)) return undefined;
  const input = numberOf(raw.input_tokens);
  const cached = numberOf(raw.cached_input_tokens);
  const written = numberOf(raw.cache_write_input_tokens);
  const output = numberOf(raw.output_tokens);
  const reasoning = numberOf(raw.reasoning_output_tokens);
  const usage: AgentUsage = {
    ...(input !== undefined ? { inputTokens: Math.max(0, input - (cached ?? 0)) } : {}),
    ...(cached !== undefined && cached > 0 ? { cacheReadInputTokens: cached } : {}),
    ...(written !== undefined && written > 0 ? { cacheCreationInputTokens: written } : {}),
    ...(output !== undefined ? { outputTokens: output } : {}),
    ...(reasoning !== undefined && reasoning > 0 ? { thoughtTokens: reasoning } : {}),
  };
  return Object.keys(usage).length === 0 ? undefined : usage;
}

function lastLines(text: string, count: number): string {
  return text.split(/\r?\n/u).filter((line) => line.trim().length > 0).slice(-count).join("\n");
}

/** Reads one line of `codex exec --json`. A line that is not JSON is told
 * as it is: codex prints a word or two of its own before the stream. */
export function readCodexLine(line: string): CodexLine | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0) return undefined;
  let event: unknown;
  try {
    event = JSON.parse(trimmed);
  } catch {
    return { kind: "text", text: `${trimmed}\n` };
  }
  if (!isRecord(event) || typeof event.type !== "string") return undefined;
  const item = isRecord(event.item) ? event.item : undefined;
  switch (event.type) {
    case "item.started":
      return item?.type === "command_execution" && typeof item.command === "string"
        ? { kind: "text", text: `$ ${item.command}\n` }
        : undefined;
    case "item.completed": {
      if (item === undefined) return undefined;
      if (item.type === "agent_message" && typeof item.text === "string") {
        return { kind: "text", text: item.text.endsWith("\n") ? item.text : `${item.text}\n` };
      }
      if (item.type === "command_execution") {
        const code = numberOf(item.exit_code);
        if (code === undefined || code === 0) return undefined;
        const output = typeof item.aggregated_output === "string" ? lastLines(item.aggregated_output, FAILED_OUTPUT_LINES) : "";
        return { kind: "text", text: `(exit ${code})${output.length > 0 ? `\n${output}` : ""}\n` };
      }
      if (item.type === "file_change" && Array.isArray(item.changes)) {
        const paths = item.changes.flatMap((change) => (isRecord(change) && typeof change.path === "string" ? [change.path] : []));
        return paths.length > 0 ? { kind: "text", text: `changed ${paths.join(", ")}\n` } : undefined;
      }
      return undefined;
    }
    case "turn.completed": {
      const usage = codexUsage(event.usage);
      return usage === undefined ? undefined : { kind: "usage", usage };
    }
    case "turn.failed": {
      const error = isRecord(event.error) ? event.error : undefined;
      return { kind: "failure", message: typeof error?.message === "string" ? error.message : "the turn failed" };
    }
    case "error":
      return { kind: "failure", message: typeof event.message === "string" ? event.message : "codex reported an error" };
    default:
      return undefined;
  }
}

export class CodexCliAdapter implements AgentAdapter {
  readonly name = "codex-cli";

  buildInvocation(command: Command): AdapterInvocation {
    const args = ["exec", "--skip-git-repo-check", "--json", "--sandbox", codexSandboxFor(command.kind)];
    if (command.model) args.push("--model", command.model);
    // codex has no dedicated effort flag — only a generic `-c key=value`
    // config override. Render that one key only: `-c` reaches codex's
    // whole configuration surface (sandbox mode, approval policy,
    // provider), and admitting the flag rather than this one setting
    // would open the argv allowlist far wider than this feature needs —
    // see design.md, "codex-cli's config override is admitted for
    // exactly one key". No budget mechanism was found for codex.
    if (command.effort) args.push("-c", `model_reasoning_effort="${command.effort}"`);
    return { kind: "process", executable: "codex", args };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("CodexCliAdapter expects invocation.kind === 'process'");
    }
    const { runId } = command;
    let pending = "";
    let failure: string | undefined;
    const told = function* (lines: string[]): Generator<Event> {
      for (const line of lines) {
        const read = readCodexLine(line);
        if (read === undefined) continue;
        const timestamp = new Date().toISOString();
        if (read.kind === "text") yield { kind: "stdout", runId, timestamp, chunk: read.text };
        else if (read.kind === "usage") yield { kind: "usageReported", runId, timestamp, usage: read.usage };
        else {
          failure = read.message;
          yield { kind: "stderr", runId, timestamp, chunk: `${read.message}\n` };
        }
      }
    };
    for await (const event of spawnAndStream({
      executable: invocation.executable,
      args: invocation.args,
      cwd: command.cwd,
      runId,
      commandKind: command.kind,
      stdin: `${commandInstruction(command.kind)}\n\n${prompt}`,
      signal,
    })) {
      if (event.kind === "stdout") {
        // One event per line; a line may arrive in pieces.
        const lines = (pending + event.chunk).split("\n");
        pending = lines.pop() ?? "";
        yield* told(lines);
        continue;
      }
      if (event.kind === "completed" || event.kind === "failed" || event.kind === "cancelled") {
        yield* told([pending]);
        pending = "";
      }
      // codex exits 0 after a turn it reported failed: the turn's word is
      // the one that counts.
      if (event.kind === "completed" && failure !== undefined) {
        const failed = say("OSW-AGT-222", { why: failure });
        yield { kind: "failed", runId, timestamp: event.timestamp, reason: failed.text, code: failed.code };
        continue;
      }
      yield event;
    }
  }
}
