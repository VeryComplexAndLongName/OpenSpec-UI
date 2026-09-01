import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "../protocol.js";

const spawnAndStreamMock = vi.fn();
vi.mock("./shared.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared.js")>();
  return { ...actual, spawnAndStream: (...args: unknown[]) => spawnAndStreamMock(...args) };
});

const { GeminiCliAdapter } = await import("./gemini.js");

const command: Command = {
  kind: "status",
  cwd: "/workspace/repo",
  runId: "run-4",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("GeminiCliAdapter", () => {
  it("builds a process invocation for the gemini binary", () => {
    const adapter = new GeminiCliAdapter();
    expect(adapter.buildInvocation(command)).toEqual({
      kind: "process",
      executable: "gemini",
      args: ["--yolo"],
    });
  });

  it("delegates to spawnAndStream and passes through its event stream unchanged", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-4", timestamp: "t", command: "status", cwd: "/workspace/repo" };
      yield { kind: "cancelled", runId: "run-4", timestamp: "t" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const adapter = new GeminiCliAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "FILE CONTENT HERE", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "cancelled"]);
    expect(spawnAndStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executable: "gemini",
        args: ["--yolo"],
        cwd: "/workspace/repo",
        runId: "run-4",
        commandKind: "status",
        stdin: expect.stringContaining("FILE CONTENT HERE"),
      }),
    );
  });
});
