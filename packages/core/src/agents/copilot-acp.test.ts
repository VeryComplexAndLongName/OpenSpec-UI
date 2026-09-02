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

const { CopilotCliAcpAdapter } = await import("./copilot-acp.js");

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-acp-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("CopilotCliAcpAdapter", () => {
  it("builds a process invocation for 'copilot --acp' — no --allow-all-tools/--yolo (would suppress session/request_permission entirely)", () => {
    const adapter = new CopilotCliAcpAdapter();
    expect(adapter.buildInvocation(command)).toEqual({
      kind: "process",
      executable: "copilot",
      args: ["--acp"],
    });
  });

  it("appends --model/--effort/--max-ai-credits after --acp when resolved", () => {
    const adapter = new CopilotCliAcpAdapter();
    expect(
      adapter.buildInvocation({ ...command, model: "gpt-5-mini", effort: "high", budget: { maxAiCredits: 40 } }),
    ).toEqual({
      kind: "process",
      executable: "copilot",
      args: ["--acp", "--model", "gpt-5-mini", "--effort", "high", "--max-ai-credits", "40"],
    });
  });

  it("delegates to the shared driver's runProcess and passes through its event stream unchanged", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-acp-1", timestamp: "t", command: "implement", cwd: "/workspace/repo" };
      yield { kind: "agentUpdate", runId: "run-acp-1", timestamp: "t", update: { sessionUpdate: "plan" } };
      yield { kind: "completed", runId: "run-acp-1", timestamp: "t" };
    }
    runProcessMock.mockReturnValue(fakeEvents());

    const adapter = new CopilotCliAcpAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "FILE CONTENT HERE", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "agentUpdate", "completed"]);
    expect(runProcessMock).toHaveBeenCalledWith({
      executable: "copilot",
      args: ["--acp"],
      cwd: "/workspace/repo",
      runId: "run-acp-1",
      commandKind: "implement",
      prompt: expect.stringContaining("FILE CONTENT HERE"),
      signal: expect.anything(),
    });
  });

  it("delivers a prompt far longer than the raw-text adapter's MAX_ARGV_PROMPT_LENGTH (6000) whole, over ACP session/prompt — no truncation, no fallback text", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "completed", runId: "run-acp-1", timestamp: "t" };
    }
    runProcessMock.mockReturnValue(fakeEvents());

    const oversizedContent = "x".repeat(20_000);
    const adapter = new CopilotCliAcpAdapter();
    const invocation = adapter.buildInvocation(command);
    for await (const _ of adapter.execute(invocation, command, oversizedContent, new AbortController().signal)) {
      // drain
    }

    const call = runProcessMock.mock.calls[0]?.[0] as { prompt: string };
    expect(call.prompt).toContain(oversizedContent);
    expect(call.prompt.length).toBeGreaterThan(20_000);
  });

  it("resolvePermission delegates to the shared driver", () => {
    resolvePermissionMock.mockReturnValue(true);
    const adapter = new CopilotCliAcpAdapter();
    expect(adapter.resolvePermission("run-acp-1", "perm-1", "allow")).toBe(true);
    expect(resolvePermissionMock).toHaveBeenCalledWith("run-acp-1", "perm-1", "allow");
  });
});
