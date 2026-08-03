import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "../protocol.js";

const spawnAndStreamMock = vi.fn();
vi.mock("./shared.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared.js")>();
  return { ...actual, spawnAndStream: (...args: unknown[]) => spawnAndStreamMock(...args) };
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
    expect(spawnAndStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executable: "copilot",
        args: ["-p", "--allow-all-tools"],
        cwd: "/workspace/repo",
        runId: "run-2",
        commandKind: "review",
        stdin: expect.stringContaining("FILE CONTENT HERE"),
      }),
    );
  });
});
