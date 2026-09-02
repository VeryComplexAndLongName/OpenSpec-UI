import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
vi.mock("cross-spawn", () => ({
  default: (...args: unknown[]) => spawnMock(...args),
}));

const { detectAvailableAgents, detectAvailableAgentsDetailed, extractVersionToken } = await import("./agent-detection.js");

class FakeChildProcess extends EventEmitter {
  kill = vi.fn();
  stdout = new EventEmitter();
}

function emitStdout(child: FakeChildProcess, text: string): void {
  child.stdout.emit("data", Buffer.from(text, "utf8"));
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
    expect(spawnMock).toHaveBeenCalledWith("claude", ["--version"], { stdio: ["ignore", "pipe", "ignore"] });
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

  it("reports an agent as not detected when spawning errors (e.g. ENOENT), without waiting out the spawn budget", async () => {
    // Fake timers with nothing advancing them: if a missing executable had
    // to wait for the spawn timeout, this would never resolve. A genuinely
    // absent CLI must resolve off `cross-spawn`'s `error` event alone.
    vi.useFakeTimers();
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => child.emit("error", new Error("ENOENT")));
      return child;
    });
    globalThis.fetch = vi.fn().mockResolvedValue({});

    const result = await detectAvailableAgents();

    expect(result["gemini-cli"]).toBe(false);
  });

  it("reports an agent as not detected when its probe never exits, once the spawn budget elapses", async () => {
    vi.useFakeTimers();
    const children: FakeChildProcess[] = [];
    spawnMock.mockImplementation(() => {
      // Never emits `exit` or `error` — only the timeout can settle this.
      const child = new FakeChildProcess();
      children.push(child);
      return child;
    });
    globalThis.fetch = vi.fn().mockResolvedValue({});

    const pending = detectAvailableAgents();
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    // The budget the probe actually uses must be well past the old 3 s one
    // that reported installed-but-slow CLIs as absent; asserting the exact
    // constant here would just restate it, so assert what went wrong before.
    await vi.advanceTimersByTimeAsync(3000);
    expect(settled).toBe(false);

    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result["claude-cli"]).toBe(false);
    expect(children[0]?.kill).toHaveBeenCalled();
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

  it("resolves all nine registered agent ids, including the four ACP-flavored ones", async () => {
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => child.emit("exit", 0));
      return child;
    });
    globalThis.fetch = vi.fn().mockResolvedValue({});

    const result = await detectAvailableAgents();

    expect(Object.keys(result).sort()).toEqual(
      [
        "claude-cli",
        "claude-cli-acp",
        "codex-cli",
        "codex-cli-acp",
        "copilot-cli",
        "copilot-cli-acp",
        "gemini-cli",
        "gemini-cli-acp",
        "local-llm",
      ].sort(),
    );
  });
});

describe("extractVersionToken", () => {
  it("extracts the version token from the live-confirmed format", () => {
    expect(extractVersionToken("2.1.237 (Claude Code)")).toBe("2.1.237");
  });

  it("returns undefined when no version-looking token is present", () => {
    expect(extractVersionToken("not a version string")).toBeUndefined();
  });
});

describe("detectAvailableAgentsDetailed", () => {
  it("reports a version when the probe's stdout contains one (task 2.4)", async () => {
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => {
        emitStdout(child, "2.1.237 (Claude Code)");
        child.emit("exit", 0);
      });
      return child;
    });
    globalThis.fetch = vi.fn().mockResolvedValue({});

    const result = await detectAvailableAgentsDetailed();

    expect(result["claude-cli"]).toEqual({ detected: true, version: "2.1.237" });
  });

  it("reports detected with no version when stdout has no version token (task 2.4)", async () => {
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => {
        emitStdout(child, "hello from a CLI with no version flag support");
        child.emit("exit", 0);
      });
      return child;
    });
    globalThis.fetch = vi.fn().mockResolvedValue({});

    const result = await detectAvailableAgentsDetailed();

    expect(result["claude-cli"]).toEqual({ detected: true, version: undefined });
  });

  it("reports not detected, exactly as today, when spawning errors (task 2.4)", async () => {
    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess();
      queueMicrotask(() => child.emit("error", new Error("ENOENT")));
      return child;
    });
    globalThis.fetch = vi.fn().mockResolvedValue({});

    const result = await detectAvailableAgentsDetailed();

    expect(result["claude-cli"]).toEqual({ detected: false });
  });
});
