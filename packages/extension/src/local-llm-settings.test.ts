import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "./test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const detectAvailableAgentsMock = vi.fn();
const detectAvailableAgentsDetailedMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  detectAvailableAgents: (...args: unknown[]) => detectAvailableAgentsMock(...args),
  detectAvailableAgentsDetailed: (...args: unknown[]) => detectAvailableAgentsDetailedMock(...args),
}));

const { detectAgentsHere, detectAgentsHereDetailed, readAgentDetectionConfig, useSecretStorage } = await import("./local-llm-settings.js");

/** Settings as a person set them, by section and key. */
function withSettings(values: Record<string, Record<string, unknown>>): void {
  const byScope = (section?: string) => ({
    get: vi.fn((key: string, fallback?: unknown) => values[section ?? ""]?.[key] ?? fallback),
  });
  vscodeMock.workspace.getConfiguration.mockImplementation(byScope as never);
}

afterEach(() => {
  vi.clearAllMocks();
});

// the-local-model-is-offered-where-it-is-set: detection was asked with
// nothing, so a local LLM named in the settings was never found.
describe("agent detection in the editor", () => {
  it("looks for the local LLM where the settings say, with the stored key, past the proxy where asked", async () => {
    withSettings({
      "openspec-ui.localLlm": { baseUrl: " http://192.168.137.33:8000/v1 " },
      "openspec-ui.agents": { ignoreSystemProxy: true },
    });
    useSecretStorage({ get: vi.fn().mockResolvedValue("the-key") } as never);
    detectAvailableAgentsMock.mockResolvedValue({ "local-llm-acp": true });
    detectAvailableAgentsDetailedMock.mockResolvedValue({ "local-llm-acp": { detected: true } });

    expect(await detectAgentsHere()).toEqual({ "local-llm-acp": true });
    expect(await detectAgentsHereDetailed()).toEqual({ "local-llm-acp": { detected: true } });

    const asked = { localLlmBaseUrl: "http://192.168.137.33:8000/v1", localLlmApiKey: "the-key", ignoreSystemProxy: true };
    expect(detectAvailableAgentsMock).toHaveBeenCalledWith(asked);
    expect(detectAvailableAgentsDetailedMock).toHaveBeenCalledWith(asked);
  });

  it("leaves out what is not set, so core falls back to the environment", async () => {
    withSettings({});
    useSecretStorage({ get: vi.fn().mockResolvedValue(undefined) } as never);

    expect(await readAgentDetectionConfig()).toEqual({ ignoreSystemProxy: false });
  });

  it("reads the settings at each question, so a changed address counts without a reload", async () => {
    useSecretStorage({ get: vi.fn().mockResolvedValue(undefined) } as never);
    withSettings({ "openspec-ui.localLlm": { baseUrl: "http://first:8000" } });
    expect((await readAgentDetectionConfig()).localLlmBaseUrl).toBe("http://first:8000");
    withSettings({ "openspec-ui.localLlm": { baseUrl: "http://second:8000" } });
    expect((await readAgentDetectionConfig()).localLlmBaseUrl).toBe("http://second:8000");
  });

  it("asks without a key when the secret storage cannot be read", async () => {
    withSettings({});
    useSecretStorage({ get: vi.fn().mockRejectedValue(new Error("locked")) } as never);

    expect(await readAgentDetectionConfig()).toEqual({ ignoreSystemProxy: false });
  });
});
