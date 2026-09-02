import { describe, expect, it, vi } from "vitest";

const listenMock = vi.fn();
const closeMock = vi.fn();
const createServerMock = vi.fn((..._args: unknown[]) => ({
  listen: listenMock,
  close: closeMock,
  accessToken: "optional-server-test-token",
}));

vi.mock("@openspec-ui/server", () => ({
  createServer: (...args: unknown[]) => createServerMock(...args),
}));

// `buildDefaultAgentRunners` is spied on (not replaced) so its real
// `Map<string, AgentRunner>` still comes back — only the `auditLog` it was
// given is captured, to prove `optional-server.ts` shares one `FileAuditLog`
// instance between the runners it audits and `createServer`'s own reader
// (task 4.2, audit-log-persistence: "supplies both the log and the
// reader" — the reader itself is `server.ts`'s `instanceof FileAuditLog`
// derivation, covered by server.test.ts's task 4.1 test; this test proves
// the same instance actually reaches both call sites from here).
const buildDefaultAgentRunnersSpy = vi.fn();
vi.mock("@openspec-ui/core", async () => {
  const actual = await vi.importActual<typeof import("@openspec-ui/core")>("@openspec-ui/core");
  return {
    ...actual,
    buildDefaultAgentRunners: (...args: [Parameters<typeof actual.buildDefaultAgentRunners>[0]]) => {
      buildDefaultAgentRunnersSpy(...args);
      return actual.buildDefaultAgentRunners(...args);
    },
  };
});

const { OptionalServerManager } = await import("./optional-server.js");
const { FileAuditLog } = await import("@openspec-ui/core");

describe("OptionalServerManager", () => {
  it("start() calls createServer with dynamic port 0 and localhost, plus explicit staticAssets paths", async () => {
    listenMock.mockResolvedValue({ address: "127.0.0.1", port: 54321 });
    const manager = new OptionalServerManager("/workspace/repo");

    const baseUrl = await manager.start();

    expect(createServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceRoot: "/workspace/repo",
        host: "127.0.0.1",
        port: 0,
        runners: expect.any(Map),
        staticAssets: expect.objectContaining({
          indexHtmlPath: expect.stringContaining("standalone"),
          appJsPath: expect.stringContaining("standalone"),
        }),
      }),
    );
    const passedOptions = createServerMock.mock.calls[0]?.[0] as { runners: Map<string, unknown> };
    expect([...passedOptions.runners.keys()]).toContain("claude-cli");
    expect(baseUrl).toBe("http://127.0.0.1:54321/#token=optional-server-test-token");
    expect(manager.isRunning).toBe(true);
    expect(manager.baseUrl).toBe("http://127.0.0.1:54321");
    expect(manager.launchUrl).toBe("http://127.0.0.1:54321/#token=optional-server-test-token");
  });

  it("start() is idempotent — a second call reuses the running server", async () => {
    listenMock.mockResolvedValue({ address: "127.0.0.1", port: 11111 });
    createServerMock.mockClear();
    const manager = new OptionalServerManager("/workspace/repo");

    await manager.start();
    const secondUrl = await manager.start();

    expect(createServerMock).toHaveBeenCalledTimes(1);
    expect(secondUrl).toBe("http://127.0.0.1:11111/#token=optional-server-test-token");
  });

  it("stop() closes the server and resets state", async () => {
    listenMock.mockResolvedValue({ address: "127.0.0.1", port: 22222 });
    const manager = new OptionalServerManager("/workspace/repo");
    await manager.start();

    await manager.stop();

    expect(closeMock).toHaveBeenCalled();
    expect(manager.isRunning).toBe(false);
    expect(manager.baseUrl).toBeUndefined();
  });

  it("stop() is a no-op when nothing is running", async () => {
    closeMock.mockClear();
    const manager = new OptionalServerManager("/workspace/repo");
    await manager.stop();
    expect(closeMock).not.toHaveBeenCalled();
  });

  it("start() shares one FileAuditLog between the runners it audits and createServer's auditLog option (task 4.2)", async () => {
    listenMock.mockResolvedValue({ address: "127.0.0.1", port: 33333 });
    buildDefaultAgentRunnersSpy.mockClear();
    createServerMock.mockClear();
    const manager = new OptionalServerManager("/workspace/repo");

    await manager.start();

    const passedAuditLog = (createServerMock.mock.calls[0]?.[0] as { auditLog?: unknown }).auditLog;
    expect(passedAuditLog).toBeInstanceOf(FileAuditLog);

    expect(buildDefaultAgentRunnersSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceRoot: "/workspace/repo", auditLog: passedAuditLog }),
    );
  });
});
