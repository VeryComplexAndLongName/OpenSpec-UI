import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runTool, TOOL_PARAMETER_TYPES, TOOL_SCHEMAS } from "./tools.js";

// local-llm-codes-in-process 2.3.
vi.setConfig({ testTimeout: 20_000 });

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function cwd(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-tools-"));
  roots.push(root);
  return root;
}

const limits = { commandTimeoutSeconds: 10, maxCommandOutputChars: 2000 };

describe("the local agent's tools", () => {
  it("offers six tools, with their parameter types for calls written as text", () => {
    expect(TOOL_SCHEMAS.map((tool) => tool.function.name)).toEqual(["read_file", "write_file", "replace_text", "list_dir", "search_text", "run_command"]);
    expect(TOOL_PARAMETER_TYPES.get("replace_text")).toEqual({ path: "string", old_text: "string", new_text: "string", expected_replacements: "integer" });
  });

  it("writes, reads, replaces, lists and searches inside the directory", async () => {
    const dir = await cwd();
    expect(await runTool("write_file", { path: "src/a.js", content: "const a = 1;\nconst b = 1;\n" }, dir, limits)).toEqual({ output: "Wrote src/a.js", failed: false });
    expect((await runTool("read_file", { path: "src/a.js" }, dir, limits)).output).toContain("const b = 1;");
    expect(await runTool("replace_text", { path: "src/a.js", old_text: "= 1", new_text: "= 2", expected_replacements: 2 }, dir, limits))
      .toEqual({ output: "Replaced 2 occurrence(s) in src/a.js", failed: false });
    expect((await runTool("replace_text", { path: "src/a.js", old_text: "= 2", new_text: "= 3" }, dir, limits)).failed).toBe(true);
    expect((await runTool("list_dir", {}, dir, limits)).output).toBe("src/");
    expect((await runTool("search_text", { query: "const b" }, dir, limits)).output).toBe("src/a.js:2: const b = 2;");
  });

  it("refuses a path outside the directory, and says so", async () => {
    const dir = await cwd();
    const result = await runTool("write_file", { path: "../escaped.txt", content: "x" }, dir, limits);
    expect(result.failed).toBe(true);
    expect(result.output).toContain("outside the working directory");
    await expect(readFile(path.join(dir, "..", "escaped.txt"), "utf8")).rejects.toThrow();
  });

  it("runs a command in the directory and gives its exit code and output", async () => {
    const dir = await cwd();
    await writeFile(path.join(dir, "here.txt"), "", "utf8");
    const result = await runTool("run_command", { command: "node -e \"console.log(require('fs').existsSync('here.txt'))\"" }, dir, limits);
    expect(result).toEqual({ output: "Exit code 0.\ntrue", failed: false });
  });

  it("cuts a command's output at the cap", async () => {
    const dir = await cwd();
    const result = await runTool("run_command", { command: "node -e \"console.log('x'.repeat(5000))\"" }, dir, { ...limits, maxCommandOutputChars: 300 });
    expect(result.output.length).toBeLessThan(400);
    expect(result.output).toContain("more characters");
  });

  it("ends a command at the time limit", async () => {
    const dir = await cwd();
    const started = Date.now();
    const result = await runTool("run_command", { command: "node -e \"setTimeout(() => {}, 60000)\"" }, dir, { ...limits, commandTimeoutSeconds: 1 });
    expect(result.failed).toBe(true);
    expect(result.output).toContain("ended after 1 s");
    expect(Date.now() - started).toBeLessThan(15_000);
  });

  it("answers an unknown tool and a missing argument without throwing", async () => {
    const dir = await cwd();
    expect(await runTool("format_disk", {}, dir, limits)).toEqual({ output: "Unknown tool: format_disk", failed: true });
    expect((await runTool("read_file", {}, dir, limits)).output).toContain('missing argument "path"');
  });
});
