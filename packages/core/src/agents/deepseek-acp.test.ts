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

const { DEEPSEEK_PREAMBLE, DSH_NODE_FLOOR_TEXT, DeepSeekAcpAdapter, nodeCanRunDsh } = await import("./deepseek-acp.js");

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
    adapter.nodeVersion = async () => "v24.18.0";

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

  // A Node above the floor that still says nothing: the version is no
  // longer the explanation, but "ACP connection closed" alone still says
  // nothing to act on.
  it("says which Node it met where dsh closed before saying anything", async () => {
    async function* closedAtOnce(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-deepseek-1", timestamp: "t", command: "implement", cwd: "/workspace/repo" };
      yield { kind: "failed", runId: "run-deepseek-1", timestamp: "t", reason: "ACP connection closed" };
    }
    runProcessMock.mockReturnValue(closedAtOnce());
    const adapter = new DeepSeekAcpAdapter();
    adapter.nodeVersion = async () => "v24.18.0";

    const events = await drain(adapter.execute(adapter.buildInvocation(command), command, "p", new AbortController().signal));

    const failed = events.find((event) => event.kind === "failed") as { reason: string };
    expect(failed.reason).toContain("ACP connection closed: dsh exited before answering, and the Node on this PATH is v24.18.0");
    expect(failed.reason).toContain(DSH_NODE_FLOOR_TEXT);
  });

  it("leaves a failure alone once the agent has spoken", async () => {
    async function* spokeThenFailed(): AsyncGenerator<Event> {
      yield { kind: "agentUpdate", runId: "run-deepseek-1", timestamp: "t", update: { sessionUpdate: "agent_message_chunk" } };
      yield { kind: "failed", runId: "run-deepseek-1", timestamp: "t", reason: "tests failed" };
    }
    runProcessMock.mockReturnValue(spokeThenFailed());
    const adapter = new DeepSeekAcpAdapter();
    adapter.nodeVersion = async () => "v24.18.0";

    const events = await drain(adapter.execute(adapter.buildInvocation(command), command, "p", new AbortController().signal));

    expect((events.at(-1) as { reason: string }).reason).toBe("tests failed");
  });

  // The whole point of asking first: dsh's entry is guarded by
  // `import.meta.main`, which Node carries from 22.18 and 24.2 on.
  describe("the Node dsh would be started on", () => {
    it.each([
      ["v20.19.0", false],
      ["v22.11.0", false],
      ["v22.17.9", false],
      ["v22.18.0", true],
      ["v22.20.1", true],
      ["v23.11.0", false],
      ["v24.1.0", false],
      ["v24.2.0", true],
      ["v24.18.0", true],
      ["v25.0.0", true],
      ["24.2.0", true],
    ])("reads %s as %s", (version, answer) => {
      expect(nodeCanRunDsh(version)).toBe(answer);
    });

    it("cannot tell from something that is not a version", () => {
      expect(nodeCanRunDsh("")).toBeUndefined();
      expect(nodeCanRunDsh("unknown")).toBeUndefined();
      expect(nodeCanRunDsh("v24")).toBeUndefined();
    });
  });

  it("refuses before spawning dsh where that Node cannot run it", async () => {
    const adapter = new DeepSeekAcpAdapter();
    adapter.nodeVersion = async () => "v22.11.0";

    const events = await drain(adapter.execute(adapter.buildInvocation(command), command, "p", new AbortController().signal));

    expect(runProcessMock).not.toHaveBeenCalled();
    expect(events.map((event) => event.kind)).toEqual(["started", "failed"]);
    const failed = events.at(-1) as { reason: string };
    expect(failed.reason).toContain("v22.11.0");
    expect(failed.reason).toContain(DSH_NODE_FLOOR_TEXT);
    expect(failed.reason).toContain("import.meta.main");
  });

  // A Node nobody can read is not a reason to refuse a run that may work.
  it("runs anyway where the Node cannot be asked its version", async () => {
    async function* fine(): AsyncGenerator<Event> {
      yield { kind: "completed", runId: "run-deepseek-1", timestamp: "t" };
    }
    runProcessMock.mockReturnValue(fine());
    const adapter = new DeepSeekAcpAdapter();
    adapter.nodeVersion = async () => undefined;

    const events = await drain(adapter.execute(adapter.buildInvocation(command), command, "p", new AbortController().signal));

    expect(runProcessMock).toHaveBeenCalledTimes(1);
    expect(events.map((event) => event.kind)).toEqual(["completed"]);
  });

  it("resolves a permission through the shared driver", () => {
    resolvePermissionMock.mockReturnValue(true);

    expect(new DeepSeekAcpAdapter().resolvePermission("run-deepseek-1", "perm-1", "deny")).toBe(true);
    expect(resolvePermissionMock).toHaveBeenCalledWith("run-deepseek-1", "perm-1", "deny");
  });
});
