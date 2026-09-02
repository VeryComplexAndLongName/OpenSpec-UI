import { afterEach, describe, expect, it, vi } from "vitest";
import type { Command, Event } from "../protocol.js";

const runProcessMock = vi.fn();
const resolvePermissionMock = vi.fn();
vi.mock("./acp-session-driver.js", () => ({
  AcpSessionDriver: vi.fn().mockImplementation(() => ({
    runProcess: (...args: unknown[]) => runProcessMock(...args),
    resolvePermission: (...args: unknown[]) => resolvePermissionMock(...args),
  })),
}));

afterEach(() => {
  runProcessMock.mockReset();
  resolvePermissionMock.mockReset();
});

const { CodexCliAcpAdapter } = await import("./codex-acp.js");

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-codex-acp-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("CodexCliAcpAdapter", () => {
  it("builds a process invocation for the externally installed codex-acp binary, with no flags", () => {
    const adapter = new CodexCliAcpAdapter();
    expect(adapter.buildInvocation(command)).toEqual({
      kind: "process",
      executable: "codex-acp",
      args: [],
    });
  });

  it("never names 'codex' (the raw CLI) as its executable — only the dedicated codex-acp binary", () => {
    const adapter = new CodexCliAcpAdapter();
    const invocation = adapter.buildInvocation(command);
    expect(invocation.kind === "process" && invocation.executable).toBe("codex-acp");
  });

  it("delegates to the shared driver's runProcess and passes through its event stream unchanged", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-codex-acp-1", timestamp: "t", command: "implement", cwd: "/workspace/repo" };
      yield { kind: "agentUpdate", runId: "run-codex-acp-1", timestamp: "t", update: { sessionUpdate: "tool_call" } };
      yield { kind: "completed", runId: "run-codex-acp-1", timestamp: "t" };
    }
    runProcessMock.mockReturnValue(fakeEvents());

    const adapter = new CodexCliAcpAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "FILE CONTENT HERE", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "agentUpdate", "completed"]);
    expect(runProcessMock).toHaveBeenCalledWith({
      executable: "codex-acp",
      args: [],
      cwd: "/workspace/repo",
      runId: "run-codex-acp-1",
      commandKind: "implement",
      prompt: expect.stringContaining("FILE CONTENT HERE"),
      signal: expect.anything(),
    });
  });

  it("resolvePermission delegates to the shared driver", () => {
    resolvePermissionMock.mockReturnValue(true);
    const adapter = new CodexCliAcpAdapter();
    expect(adapter.resolvePermission("run-codex-acp-1", "perm-1", "allow")).toBe(true);
    expect(resolvePermissionMock).toHaveBeenCalledWith("run-codex-acp-1", "perm-1", "allow");
  });
});
