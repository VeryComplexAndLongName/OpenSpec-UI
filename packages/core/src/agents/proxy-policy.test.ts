import { afterEach, describe, expect, it, vi } from "vitest";

// local-llm-codes-in-process 4.2-4.3: what a CLI agent is started with when
// agents are told to ignore the system proxy.
const spawnMock = vi.fn();
vi.mock("cross-spawn", () => ({ default: (...args: unknown[]) => spawnMock(...args) }));

const { agentSpawnEnvironment, setAgentProxyPolicy, spawnAndStream } = await import("./shared.js");
const { buildDefaultAgentRunners } = await import("../default-runners.js");

afterEach(() => {
  setAgentProxyPolicy(false);
  spawnMock.mockReset();
});

describe("agentSpawnEnvironment", () => {
  it("changes nothing while agents keep the system proxy", () => {
    setAgentProxyPolicy(false);
    expect(agentSpawnEnvironment()).toBeUndefined();
  });

  it("removes the proxy variables and sets NO_PROXY=* when agents ignore it", () => {
    vi.stubEnv("HTTPS_PROXY", "http://proxy:2080");
    vi.stubEnv("http_proxy", "http://proxy:2080");
    setAgentProxyPolicy(true);
    const env = agentSpawnEnvironment({ EXTRA: "1" });
    expect(env?.HTTPS_PROXY).toBeUndefined();
    expect(env?.http_proxy).toBeUndefined();
    expect(env?.NO_PROXY).toBe("*");
    expect(env?.EXTRA).toBe("1");
    vi.unstubAllEnvs();
  });

  it("reaches a CLI agent's spawn", async () => {
    vi.stubEnv("HTTPS_PROXY", "http://proxy:2080");
    setAgentProxyPolicy(true);
    spawnMock.mockImplementation(() => {
      throw new Error("not started in a test");
    });
    for await (const _event of spawnAndStream({ executable: "claude", args: ["-p"], cwd: process.cwd(), runId: "r", commandKind: "plan" })) { /* drained */ }
    const options = spawnMock.mock.calls[0]?.[2] as { env?: NodeJS.ProcessEnv };
    expect(options.env?.HTTPS_PROXY).toBeUndefined();
    expect(options.env?.NO_PROXY).toBe("*");
    vi.unstubAllEnvs();
  });

  it("comes from OPENSPEC_UI_IGNORE_SYSTEM_PROXY where the host says nothing, as the standalone server and the CLI do", () => {
    vi.stubEnv("OPENSPEC_UI_IGNORE_SYSTEM_PROXY", "1");
    buildDefaultAgentRunners({ workspaceRoot: process.cwd() });
    expect(agentSpawnEnvironment()?.NO_PROXY).toBe("*");
    // A host's own setting wins over the environment.
    buildDefaultAgentRunners({ workspaceRoot: process.cwd(), ignoreSystemProxy: false });
    expect(agentSpawnEnvironment()).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("is what buildDefaultAgentRunners is told", () => {
    buildDefaultAgentRunners({ workspaceRoot: process.cwd(), ignoreSystemProxy: true });
    expect(agentSpawnEnvironment()?.NO_PROXY).toBe("*");
    buildDefaultAgentRunners({ workspaceRoot: process.cwd() });
    expect(agentSpawnEnvironment()).toBeUndefined();
  });
});
