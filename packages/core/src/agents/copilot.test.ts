import { afterEach, describe, expect, it, vi } from "vitest";
import type { Command, Event } from "../protocol.js";

const spawnAndStreamMock = vi.fn();
vi.mock("./shared.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared.js")>();
  return { ...actual, spawnAndStream: (...args: unknown[]) => spawnAndStreamMock(...args) };
});

// `.mock.calls[0]` below means "this test's own call" — without a reset,
// calls accumulate across the whole file and index 0 would silently keep
// referring to the very first test's invocation instead.
afterEach(() => {
  spawnAndStreamMock.mockReset();
});

const { CopilotCliAdapter } = await import("./copilot.js");

const command: Command = {
  kind: "review",
  cwd: "/workspace/repo",
  runId: "run-2",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("CopilotCliAdapter", () => {
  it("builds a process invocation for the copilot binary", () => {
    const adapter = new CopilotCliAdapter();
    expect(adapter.buildInvocation(command)).toEqual({
      kind: "process",
      executable: "copilot",
      args: ["-p", "--allow-all-tools"],
    });
  });

  it("delegates to spawnAndStream and passes through its event stream unchanged", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-2", timestamp: "t", command: "review", cwd: "/workspace/repo" };
      yield { kind: "stdout", runId: "run-2", timestamp: "t", chunk: "reviewing...\n" };
      yield { kind: "completed", runId: "run-2", timestamp: "t" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const adapter = new CopilotCliAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "FILE CONTENT HERE")) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "stdout", "completed"]);
    expect(spawnAndStreamMock).toHaveBeenCalledWith({
      executable: "copilot",
      args: ["-p", expect.stringContaining("FILE CONTENT HERE"), "--allow-all-tools"],
      cwd: "/workspace/repo",
      runId: "run-2",
      commandKind: "review",
    });
  });

  it("builds a process invocation with a trailing --model <value> after --allow-all-tools when a model is resolved", () => {
    const adapter = new CopilotCliAdapter();
    expect(adapter.buildInvocation({ ...command, model: "gpt-5-mini" })).toEqual({
      kind: "process",
      executable: "copilot",
      args: ["-p", "--allow-all-tools", "--model", "gpt-5-mini"],
    });
  });

  it("appends --model <value> after --allow-all-tools in the spawned argv when a model is resolved", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "completed", runId: "run-2", timestamp: "t" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const modelCommand: Command = { ...command, model: "gpt-5-mini" };
    const adapter = new CopilotCliAdapter();
    const invocation = adapter.buildInvocation(modelCommand);
    for await (const _ of adapter.execute(invocation, modelCommand, "prompt body")) {
      // drain
    }

    const call = spawnAndStreamMock.mock.calls[0]?.[0] as { args: string[] };
    expect(call.args[0]).toBe("-p");
    expect(call.args[2]).toBe("--allow-all-tools");
    expect(call.args.slice(3)).toEqual(["--model", "gpt-5-mini"]);
  });

  it("embeds the prompt as a positional argument, not via stdin (unlike claude/codex/gemini)", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "completed", runId: "run-2", timestamp: "t" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const adapter = new CopilotCliAdapter();
    const invocation = adapter.buildInvocation(command);
    for await (const _ of adapter.execute(invocation, command, "prompt body")) {
      // drain
    }

    const call = spawnAndStreamMock.mock.calls[0]?.[0] as { args: string[]; stdin?: string };
    expect(call.args[0]).toBe("-p");
    expect(call.args[2]).toBe("--allow-all-tools");
    expect(call.stdin).toBeUndefined();
  });

  describe("argv command-line length fallback", () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "completed", runId: "run-2", timestamp: "t" };
    }

    it("embeds full content when the prompt is under the threshold", async () => {
      spawnAndStreamMock.mockReturnValue(fakeEvents());
      const adapter = new CopilotCliAdapter();
      const invocation = adapter.buildInvocation(command);
      const shortContent = "a".repeat(100);

      for await (const _ of adapter.execute(invocation, command, shortContent)) {
        // drain
      }

      const call = spawnAndStreamMock.mock.calls[0]?.[0] as { args: string[] };
      expect(call.args[1]).toContain(shortContent);
    });

    it("falls back to a path-pointing prompt when the embedded prompt would exceed the threshold, instead of failing outright", async () => {
      spawnAndStreamMock.mockReturnValue(fakeEvents());
      const adapter = new CopilotCliAdapter();
      const invocation = adapter.buildInvocation(command);
      const oversizedContent = "x".repeat(10_000);

      for await (const _ of adapter.execute(invocation, command, oversizedContent)) {
        // drain
      }

      const call = spawnAndStreamMock.mock.calls[0]?.[0] as { args: string[] };
      const sentPrompt = call.args[1] ?? "";
      expect(sentPrompt).not.toContain(oversizedContent);
      expect(sentPrompt.length).toBeLessThan(1000);
      expect(sentPrompt).toContain(command.context.changeDir);
      expect(sentPrompt.toLowerCase()).toContain("read");
      expect(sentPrompt.toLowerCase()).toContain("do not read or modify files under");
      expect(sentPrompt).toContain("openspec instructions tasks --change <id>");
      // Delivery mechanism (argv, not stdin) is unaffected by the fallback.
      expect(call.args[0]).toBe("-p");
      expect(call.args[2]).toBe("--allow-all-tools");
    });
  });
});
