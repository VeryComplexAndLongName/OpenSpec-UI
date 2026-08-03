import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "../protocol.js";

const spawnAndStreamMock = vi.fn();
vi.mock("./shared.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared.js")>();
  return { ...actual, spawnAndStream: (...args: unknown[]) => spawnAndStreamMock(...args) };
});

const { ClaudeCliAdapter } = await import("./claude.js");

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("ClaudeCliAdapter", () => {
  it("builds a process invocation for the claude binary", () => {
    const adapter = new ClaudeCliAdapter();
    expect(adapter.buildInvocation(command)).toEqual({
      kind: "process",
      executable: "claude",
      args: ["-p", "--output-format", "text"],
    });
  });

  it("delegates to spawnAndStream and passes through its event stream unchanged", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-1", timestamp: "t", command: "implement", cwd: "/workspace/repo" };
      yield { kind: "completed", runId: "run-1", timestamp: "t" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const adapter = new ClaudeCliAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "FILE CONTENT HERE")) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "completed"]);
    expect(spawnAndStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executable: "claude",
        args: ["-p", "--output-format", "text"],
        cwd: "/workspace/repo",
        runId: "run-1",
        commandKind: "implement",
        stdin: expect.stringContaining("FILE CONTENT HERE"),
      }),
    );
  });

  it("rejects an http invocation as a programming error", async () => {
    const adapter = new ClaudeCliAdapter();
    await expect(async () => {
      for await (const _ of adapter.execute({ kind: "http", url: "x", method: "POST" }, command, "p")) {
        // no-op
      }
    }).rejects.toThrow();
  });
});
