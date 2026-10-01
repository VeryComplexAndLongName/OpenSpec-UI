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

const { LocalLlmAcpAdapter } = await import("./local-llm-acp.js");

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-local-llm-acp-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("LocalLlmAcpAdapter", () => {
  it("builds a process invocation with the options before the acp subcommand", () => {
    // `coding-agent` reads its options only before the subcommand:
    // `coding-agent acp --base-url ...` exits with its usage.
    const adapter = new LocalLlmAcpAdapter({
      executable: "coding-agent",
      baseUrl: "http://gpu.lan:8000/v1",
      model: "qwen2.5-coder",
      limits: {},
    });
    expect(adapter.buildInvocation(command)).toEqual({
      kind: "process",
      executable: "coding-agent",
      args: ["--base-url", "http://gpu.lan:8000/v1", "--model", "qwen2.5-coder", "acp"],
    });
  });

  it("renders only configured loop limits and omits absent ones", () => {
    const adapter = new LocalLlmAcpAdapter({
      executable: "coding-agent",
      baseUrl: "http://gpu.lan:8000/v1",
      model: "qwen2.5-coder",
      limits: {
        maxIterations: 40,
        maxSeconds: 300,
        maxContextShare: 0.8,
      },
    });
    expect(adapter.buildInvocation(command)).toEqual({
      kind: "process",
      executable: "coding-agent",
      args: [
        "--base-url",
        "http://gpu.lan:8000/v1",
        "--model",
        "qwen2.5-coder",
        "--max-iterations",
        "40",
        "--max-seconds",
        "300",
        "--max-context-share",
        "0.8",
        "acp",
      ],
    });
  });

  it("delegates execution to the shared ACP driver and forwards API key via env, not args", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-local-llm-acp-1", timestamp: "t", command: "implement", cwd: "/workspace/repo" };
      yield { kind: "agentUpdate", runId: "run-local-llm-acp-1", timestamp: "t", update: { sessionUpdate: "tool_call" } };
      yield { kind: "completed", runId: "run-local-llm-acp-1", timestamp: "t" };
    }
    runProcessMock.mockReturnValue(fakeEvents());

    const adapter = new LocalLlmAcpAdapter({
      executable: "coding-agent",
      baseUrl: "http://gpu.lan:8000/v1",
      model: "qwen2.5-coder",
      apiKey: "secret-key",
      limits: {},
    });
    const invocation = adapter.buildInvocation(command);

    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "FILE CONTENT HERE", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "agentUpdate", "completed"]);
    expect(runProcessMock).toHaveBeenCalledWith({
      executable: "coding-agent",
      args: ["--base-url", "http://gpu.lan:8000/v1", "--model", "qwen2.5-coder", "acp"],
      cwd: "/workspace/repo",
      runId: "run-local-llm-acp-1",
      commandKind: "implement",
      prompt: expect.stringContaining("FILE CONTENT HERE"),
      signal: expect.anything(),
      env: {
        CODING_AGENT_API_KEY: "secret-key",
        CODING_AGENT_BASE_URL: "http://gpu.lan:8000/v1",
        CODING_AGENT_MODEL: "qwen2.5-coder",
      },
    });
  });

  it("resolvePermission delegates to the shared driver", () => {
    resolvePermissionMock.mockReturnValue(true);
    const adapter = new LocalLlmAcpAdapter({
      executable: "coding-agent",
      baseUrl: "http://gpu.lan:8000/v1",
      model: "qwen2.5-coder",
      limits: {},
    });
    expect(adapter.resolvePermission("run-local-llm-acp-1", "perm-1", "allow")).toBe(true);
    expect(resolvePermissionMock).toHaveBeenCalledWith("run-local-llm-acp-1", "perm-1", "allow");
  });
});
