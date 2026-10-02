import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../../direct-fetch.js";
import { runAgentLoop, type LoopEvent } from "./agent-loop.js";
import { TOOL_PARAMETER_TYPES, TOOL_SCHEMAS } from "./tools.js";

// local-llm-codes-in-process 2.5.
// Temporary directories: the file took 206 ms alone on 2026-10-02; the ceiling is the
// one the other local-agent tests use, for a loaded machine.
vi.setConfig({ testTimeout: 20_000 });
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function model(answers: Array<Record<string, unknown>>, usage = { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 }): FetchLike {
  let turn = 0;
  return async () => {
    const message = answers[Math.min(turn, answers.length - 1)];
    turn += 1;
    return new Response(JSON.stringify({ choices: [{ message }], usage }), { status: 200 });
  };
}

const writeCall = { content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "write_file", arguments: '{"path":"a.txt","content":"x"}' } }] };
const listCall = { content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "list_dir", arguments: "{}" } }] };

async function run(fetchImpl: FetchLike, limits = {}) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "openspec-loop-"));
  roots.push(cwd);
  const events: LoopEvent[] = [];
  const result = await runAgentLoop("go", {
    chat: { settings: { baseUrl: "http://x" }, model: "m", fetch: fetchImpl, tools: TOOL_SCHEMAS, parameterTypes: TOOL_PARAMETER_TYPES },
    cwd,
    limits,
    onEvent: (event) => { events.push(event); },
  });
  return { cwd, events, result };
}

describe("runAgentLoop", () => {
  it("runs a turn that writes a file, and ends when the model answers without a call", async () => {
    const { cwd, events, result } = await run(model([writeCall, { content: "Done." }]));
    expect(result).toMatchObject({ stopReason: "completed", message: "Done.", usage: { promptTokens: 200, completionTokens: 20, totalTokens: 220, reported: true } });
    expect(events.map((event) => event.type)).toEqual(["usage", "tool_call", "tool_result", "usage", "text"]);
    expect(await readFile(path.join(cwd, "a.txt"), "utf8")).toBe("x");
  });

  it("stops at the iteration limit", async () => {
    const { result } = await run(model([listCall]), { maxIterations: 3 });
    expect(result).toMatchObject({ stopReason: "max_iterations", message: "Stopped at the 3-iteration limit." });
  });

  it("stops at the tool-call limit", async () => {
    const { result } = await run(model([listCall]), { maxToolCalls: 2 });
    expect(result.stopReason).toBe("max_tool_calls");
  });

  it("stops at a token limit", async () => {
    const { result } = await run(model([listCall]), { maxTotalTokens: 300 });
    expect(result.stopReason).toBe("max_total_tokens");
  });
});
