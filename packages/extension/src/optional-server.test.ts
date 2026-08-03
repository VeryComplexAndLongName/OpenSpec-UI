import { describe, expect, it, vi } from "vitest";

const listenMock = vi.fn();
const closeMock = vi.fn();
const createServerMock = vi.fn((..._args: unknown[]) => ({ listen: listenMock, close: closeMock }));

vi.mock("@openspec-ui/server", () => ({
  createServer: (...args: unknown[]) => createServerMock(...args),
}));

const { OptionalServerManager } = await import("./optional-server.js");

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
        staticAssets: expect.objectContaining({
          indexHtmlPath: expect.stringContaining("standalone"),
          appJsPath: expect.stringContaining("standalone"),
        }),
      }),
    );
    expect(baseUrl).toBe("http://127.0.0.1:54321");
    expect(manager.isRunning).toBe(true);
    expect(manager.baseUrl).toBe("http://127.0.0.1:54321");
  });

  it("start() is idempotent — a second call reuses the running server", async () => {
    listenMock.mockResolvedValue({ address: "127.0.0.1", port: 11111 });
    createServerMock.mockClear();
    const manager = new OptionalServerManager("/workspace/repo");

    await manager.start();
    const secondUrl = await manager.start();

    expect(createServerMock).toHaveBeenCalledTimes(1);
    expect(secondUrl).toBe("http://127.0.0.1:11111");
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
});
