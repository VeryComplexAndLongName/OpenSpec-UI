import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "../protocol.js";

const spawnAndStreamMock = vi.fn();
vi.mock("./shared.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared.js")>();
  return { ...actual, spawnAndStream: (...args: unknown[]) => spawnAndStreamMock(...args) };
});

const { CodexCliAdapter, codexSandboxFor, codexUsage, readCodexLine } = await import("./codex.js");

const command: Command = {
  kind: "plan",
  cwd: "/workspace/repo",
  runId: "run-3",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

const BASE = ["exec", "--skip-git-repo-check", "--json"];

function argsOf(run: Command): string[] {
  const invocation = new CodexCliAdapter().buildInvocation(run);
  if (invocation.kind !== "process") throw new Error("codex runs a process");
  return invocation.args;
}

async function eventsOf(lines: Array<string | string[]>, kind: Command["kind"] = "implement"): Promise<Event[]> {
  async function* fakeEvents(): AsyncGenerator<Event> {
    yield { kind: "started", runId: "run-3", timestamp: "t", command: kind, cwd: "/workspace/repo" };
    for (const chunk of lines) {
      yield { kind: "stdout", runId: "run-3", timestamp: "t", chunk: Array.isArray(chunk) ? chunk.join("") : `${chunk}\n` };
    }
    yield { kind: "completed", runId: "run-3", timestamp: "t" };
  }
  spawnAndStreamMock.mockReturnValue(fakeEvents());
  const adapter = new CodexCliAdapter();
  const run = { ...command, kind };
  const events: Event[] = [];
  for await (const event of adapter.execute(adapter.buildInvocation(run), run, "do it", new AbortController().signal)) events.push(event);
  return events;
}

// Lines as codex-cli 0.164.0 wrote them in a trial run on 2026-10-24.
const TRIAL = [
  "Reading prompt from stdin...",
  '{"type":"thread.started","thread_id":"01a16b69"}',
  '{"type":"turn.started"}',
  '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"I\'ll create hello.txt containing exactly `hi`.\\n"}}',
  '{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"pwsh -Command Set-Content hello.txt hi","aggregated_output":"","exit_code":null,"status":"in_progress"}}',
  '{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"pwsh -Command Set-Content hello.txt hi","aggregated_output":"","exit_code":0,"status":"completed"}}',
  '{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"DONE"}}',
  '{"type":"turn.completed","usage":{"input_tokens":30545,"cached_input_tokens":24832,"cache_write_input_tokens":0,"output_tokens":85,"reasoning_output_tokens":0}}',
];

describe("CodexCliAdapter - the invocation (codex-cli-is-a-full-agent)", () => {
  it("names a writing sandbox for a stage that writes the change, and a read-only one for every other command", () => {
    const adapter = new CodexCliAdapter();
    expect(adapter.buildInvocation(command)).toEqual({ kind: "process", executable: "codex", args: [...BASE, "--sandbox", "workspace-write"] });
    expect(argsOf({ ...command, kind: "review" })).toEqual([...BASE, "--sandbox", "read-only"]);
    expect(["plan", "implement", "update", "verify"].map((kind) => codexSandboxFor(kind as Command["kind"]))).toEqual(Array(4).fill("workspace-write"));
    expect(["review", "status", "list", "show", "validate"].map((kind) => codexSandboxFor(kind as Command["kind"]))).toEqual(Array(5).fill("read-only"));
  });

  it("passes the model with --model, and the effort as its one config key", () => {
    const adapter = new CodexCliAdapter();
    expect(argsOf({ ...command, model: "gpt-6.1-sol", effort: "medium" })).toEqual([
      ...BASE, "--sandbox", "workspace-write", "--model", "gpt-6.1-sol", "-c", 'model_reasoning_effort="medium"',
    ]);
  });

  it("renders nothing for a budget — no mechanism exists for codex", () => {
    const adapter = new CodexCliAdapter();
    expect(argsOf({ ...command, budget: { maxCostUsd: 5 } })).toEqual([...BASE, "--sandbox", "workspace-write"]);
  });
});

describe("CodexCliAdapter - the event stream", () => {
  it("tells a trial run's messages and commands as prose, and reports its usage with cached input apart", async () => {
    const events = await eventsOf(TRIAL);

    const prose = events.filter((event) => event.kind === "stdout").map((event) => (event as { chunk: string }).chunk).join("");
    expect(prose).toBe("Reading prompt from stdin...\nI'll create hello.txt containing exactly `hi`.\n$ pwsh -Command Set-Content hello.txt hi\nDONE\n");
    expect(events.find((event) => event.kind === "usageReported")).toMatchObject({
      usage: { inputTokens: 30545 - 24832, cacheReadInputTokens: 24832, outputTokens: 85 },
    });
    expect(events.at(-1)?.kind).toBe("completed");
  });

  it("reads a line that arrives in pieces once it is whole", async () => {
    const line = '{"type":"item.completed","item":{"type":"agent_message","text":"Starting task 1.1"}}\n';
    const events = await eventsOf([[line.slice(0, 20)], [line.slice(20)]]);

    expect(events.filter((event) => event.kind === "stdout").map((event) => (event as { chunk: string }).chunk)).toEqual(["Starting task 1.1\n"]);
  });

  it("fails a run whose turn codex reported failed, though codex exits 0", async () => {
    const events = await eventsOf([
      '{"type":"turn.started"}',
      '{"type":"turn.failed","error":{"message":"model gpt-x is not available"}}',
    ]);

    expect(events.at(-1)).toMatchObject({ kind: "failed", code: "OSW-AGT-222", reason: "codex reported the turn failed: model gpt-x is not available" });
    expect(events.some((event) => event.kind === "completed")).toBe(false);
  });

  it("says a failed command's exit code and the end of its output", () => {
    const read = readCodexLine(JSON.stringify({
      type: "item.completed",
      item: { type: "command_execution", command: "npm test", aggregated_output: "a\nb\nError: 2 failing\n", exit_code: 1 },
    }));

    expect(read).toEqual({ kind: "text", text: "(exit 1)\na\nb\nError: 2 failing\n" });
  });

  it("reports no usage where none was given, and never a zero for an absent field", () => {
    expect(codexUsage(undefined)).toBeUndefined();
    expect(codexUsage({ output_tokens: 7 })).toEqual({ outputTokens: 7 });
  });

  it("hands the prompt over stdin, in the change's directory", async () => {
    await eventsOf([]);
    expect(spawnAndStreamMock).toHaveBeenCalledWith(expect.objectContaining({
      executable: "codex",
      cwd: "/workspace/repo",
      runId: "run-3",
      stdin: expect.stringContaining("do it"),
    }));
  });
});
