import { afterEach, describe, expect, it, vi } from "vitest";
import type { Command, Event } from "../protocol.js";

// deepseek-joins-as-an-acp-agent. The driver is the shared ACP one, tested
// on its own; this holds what is DeepSeek's: the executable, the profile
// that makes it an ACP server, and the preamble every prompt carries.

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

const { DEEPSEEK_PREAMBLE, DeepSeekAcpAdapter } = await import("./deepseek-acp.js");

async function drain(iterable: AsyncIterable<Event>): Promise<Event[]> {
  const events: Event[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-deepseek-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("DeepSeekAcpAdapter", () => {
  it("starts dsh's ACP profile, and nothing else", () => {
    expect(new DeepSeekAcpAdapter().buildInvocation(command)).toEqual({
      kind: "process",
      executable: "dsh",
      args: ["--profile", "acp"],
    });
  });

  it("hands the driver the prompt with the literal-instructions preamble first, and passes its events through", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-deepseek-1", timestamp: "t", command: "implement", cwd: "/workspace/repo" };
      yield { kind: "completed", runId: "run-deepseek-1", timestamp: "t" };
    }
    runProcessMock.mockReturnValue(fakeEvents());
    const adapter = new DeepSeekAcpAdapter();

    const events: Event[] = [];
    for await (const event of adapter.execute(adapter.buildInvocation(command), command, "THE CHANGE", new AbortController().signal)) {
      events.push(event);
    }

    expect(events.map((event) => event.kind)).toEqual(["started", "completed"]);
    const given = runProcessMock.mock.calls[0]?.[0] as { executable: string; args: string[]; prompt: string };
    expect(given.executable).toBe("dsh");
    expect(given.args).toEqual(["--profile", "acp"]);
    expect(given.prompt.startsWith(DEEPSEEK_PREAMBLE)).toBe(true);
    expect(given.prompt).toContain("THE CHANGE");
  });

  // dsh exits with code 0 and no word on Node 22.11, which this
  // repository pins; "ACP connection closed" alone says nothing to act on.
  it("says which Node it met where dsh closed before saying anything", async () => {
    async function* closedAtOnce(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-deepseek-1", timestamp: "t", command: "implement", cwd: "/workspace/repo" };
      yield { kind: "failed", runId: "run-deepseek-1", timestamp: "t", reason: "ACP connection closed" };
    }
    runProcessMock.mockReturnValue(closedAtOnce());
    const adapter = new DeepSeekAcpAdapter();
    adapter.nodeVersion = async () => "v22.11.0";

    const events = await drain(adapter.execute(adapter.buildInvocation(command), command, "p", new AbortController().signal));

    const failed = events.find((event) => event.kind === "failed") as { reason: string };
    expect(failed.reason).toContain("ACP connection closed: dsh exited before answering, and the Node on this PATH is v22.11.0");
  });

  it("leaves a failure alone once the agent has spoken", async () => {
    async function* spokeThenFailed(): AsyncGenerator<Event> {
      yield { kind: "agentUpdate", runId: "run-deepseek-1", timestamp: "t", update: { sessionUpdate: "agent_message_chunk" } };
      yield { kind: "failed", runId: "run-deepseek-1", timestamp: "t", reason: "tests failed" };
    }
    runProcessMock.mockReturnValue(spokeThenFailed());
    const adapter = new DeepSeekAcpAdapter();
    adapter.nodeVersion = async () => { throw new Error("not asked"); };

    const events = await drain(adapter.execute(adapter.buildInvocation(command), command, "p", new AbortController().signal));

    expect((events.at(-1) as { reason: string }).reason).toBe("tests failed");
  });

  it("resolves a permission through the shared driver", () => {
    resolvePermissionMock.mockReturnValue(true);

    expect(new DeepSeekAcpAdapter().resolvePermission("run-deepseek-1", "perm-1", "deny")).toBe(true);
    expect(resolvePermissionMock).toHaveBeenCalledWith("run-deepseek-1", "perm-1", "deny");
  });
});
