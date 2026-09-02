import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "../protocol.js";

const spawnAndStreamMock = vi.fn();
vi.mock("./shared.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared.js")>();
  return { ...actual, spawnAndStream: (...args: unknown[]) => spawnAndStreamMock(...args) };
});

const { CodexCliAdapter } = await import("./codex.js");

const command: Command = {
  kind: "plan",
  cwd: "/workspace/repo",
  runId: "run-3",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("CodexCliAdapter", () => {
  it("builds a process invocation for the codex binary", () => {
    const adapter = new CodexCliAdapter();
    expect(adapter.buildInvocation(command)).toEqual({
      kind: "process",
      executable: "codex",
      args: ["exec", "--skip-git-repo-check"],
    });
  });

  it("appends -c model_reasoning_effort=\"<level>\" when an effort is resolved", () => {
    const adapter = new CodexCliAdapter();
    expect(adapter.buildInvocation({ ...command, effort: "medium" })).toEqual({
      kind: "process",
      executable: "codex",
      args: ["exec", "--skip-git-repo-check", "-c", 'model_reasoning_effort="medium"'],
    });
  });

  it("renders nothing for a budget — no mechanism exists for codex", () => {
    const adapter = new CodexCliAdapter();
    expect(adapter.buildInvocation({ ...command, budget: { maxCostUsd: 5 } })).toEqual({
      kind: "process",
      executable: "codex",
      args: ["exec", "--skip-git-repo-check"],
    });
  });

  it("delegates to spawnAndStream and passes through its event stream unchanged", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-3", timestamp: "t", command: "plan", cwd: "/workspace/repo" };
      yield { kind: "failed", runId: "run-3", timestamp: "t", reason: "boom" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const adapter = new CodexCliAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "FILE CONTENT HERE", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "failed"]);
    expect(spawnAndStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executable: "codex",
        args: ["exec", "--skip-git-repo-check"],
        cwd: "/workspace/repo",
        runId: "run-3",
        commandKind: "plan",
        stdin: expect.stringContaining("FILE CONTENT HERE"),
      }),
    );
  });
});
