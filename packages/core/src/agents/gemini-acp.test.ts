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

const { GeminiCliAcpAdapter } = await import("./gemini-acp.js");

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-gemini-acp-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("GeminiCliAcpAdapter", () => {
  it("builds a process invocation for 'gemini --experimental-acp' — no --yolo (would suppress session/request_permission entirely)", () => {
    const adapter = new GeminiCliAcpAdapter();
    expect(adapter.buildInvocation(command)).toEqual({
      kind: "process",
      executable: "gemini",
      args: ["--experimental-acp"],
    });
  });

  it("renders no model/effort/budget flag, even when the command carries them", () => {
    const adapter = new GeminiCliAcpAdapter();
    expect(adapter.buildInvocation({ ...command, model: "x", effort: "high", budget: { maxCostUsd: 1 } })).toEqual({
      kind: "process",
      executable: "gemini",
      args: ["--experimental-acp"],
    });
  });

  it("delegates to the shared driver's runProcess and passes through its event stream unchanged", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-gemini-acp-1", timestamp: "t", command: "implement", cwd: "/workspace/repo" };
      yield { kind: "agentUpdate", runId: "run-gemini-acp-1", timestamp: "t", update: { sessionUpdate: "plan" } };
      yield { kind: "completed", runId: "run-gemini-acp-1", timestamp: "t" };
    }
    runProcessMock.mockReturnValue(fakeEvents());

    const adapter = new GeminiCliAcpAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "FILE CONTENT HERE", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "agentUpdate", "completed"]);
    expect(runProcessMock).toHaveBeenCalledWith({
      executable: "gemini",
      args: ["--experimental-acp"],
      cwd: "/workspace/repo",
      runId: "run-gemini-acp-1",
      commandKind: "implement",
      prompt: expect.stringContaining("FILE CONTENT HERE"),
      signal: expect.anything(),
    });
  });

  it("resolvePermission delegates to the shared driver", () => {
    resolvePermissionMock.mockReturnValue(false);
    const adapter = new GeminiCliAcpAdapter();
    expect(adapter.resolvePermission("run-gemini-acp-1", "perm-1", "deny")).toBe(false);
    expect(resolvePermissionMock).toHaveBeenCalledWith("run-gemini-acp-1", "perm-1", "deny");
  });
});
