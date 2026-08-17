import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
vi.mock("cross-spawn", () => ({
  default: (...args: unknown[]) => spawnMock(...args),
}));

const { detectAvailableAgents } = await import("./agent-detection.js");

class FakeChildProcess extends EventEmitter {
  kill = vi.fn();
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  spawnMock.mockReset();
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

describe("detectAvailableAgents", () => {
  it("reports an agent as detected when its CLI process spawns and exits", async () => {
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => child.emit("exit", 0));
      return child;
    });
    globalThis.fetch = vi.fn().mockResolvedValue({});

    const result = await detectAvailableAgents();

    expect(result["claude-cli"]).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith("claude", ["--version"], { stdio: "ignore" });
  });

  it("reports an agent as detected even when --version exits non-zero (process still ran)", async () => {
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => child.emit("exit", 1));
      return child;
    });
    globalThis.fetch = vi.fn().mockResolvedValue({});

    const result = await detectAvailableAgents();

    expect(result["copilot-cli"]).toBe(true);
  });

  it("reports an agent as not detected when spawning errors (e.g. ENOENT)", async () => {
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => child.emit("error", new Error("ENOENT")));
      return child;
    });
    globalThis.fetch = vi.fn().mockResolvedValue({});

    const result = await detectAvailableAgents();

    expect(result["gemini-cli"]).toBe(false);
  });

  it("checks the local LLM via HTTP reachability instead of spawning", async () => {
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => child.emit("exit", 0));
      return child;
    });
    const fetchMock = vi.fn().mockResolvedValue({});
    globalThis.fetch = fetchMock;

    const result = await detectAvailableAgents({ localLlmBaseUrl: "http://localhost:9999" });

    expect(result["local-llm"]).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:9999", expect.objectContaining({ signal: expect.anything() }));
  });

  it("reports local-llm as not detected when the fetch rejects", async () => {
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => child.emit("exit", 0));
      return child;
    });
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("connection refused"));

    const result = await detectAvailableAgents();

    expect(result["local-llm"]).toBe(false);
  });

  it("resolves all five registered agent ids", async () => {
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => child.emit("exit", 0));
      return child;
    });
    globalThis.fetch = vi.fn().mockResolvedValue({});

    const result = await detectAvailableAgents();

    expect(Object.keys(result).sort()).toEqual(
      ["claude-cli", "codex-cli", "copilot-cli", "gemini-cli", "local-llm"].sort(),
    );
  });
});
