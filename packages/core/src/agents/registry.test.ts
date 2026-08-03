import { describe, expect, it } from "vitest";
import { AGENT_REGISTRY } from "./registry.js";
import { ClaudeCliAdapter } from "./claude.js";
import { CopilotCliAdapter } from "./copilot.js";
import { CodexCliAdapter } from "./codex.js";
import { GeminiCliAdapter } from "./gemini.js";
import { LocalLlmAdapter } from "./local-llm.js";

describe("AGENT_REGISTRY", () => {
  it("has unique ids", () => {
    const ids = AGENT_REGISTRY.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches every adapter's actual AgentAdapter.name", () => {
    const claude = new ClaudeCliAdapter();
    const copilot = new CopilotCliAdapter();
    const codex = new CodexCliAdapter();
    const gemini = new GeminiCliAdapter();
    const localLlm = new LocalLlmAdapter({ baseUrl: "http://x", model: "m" });

    const ids = AGENT_REGISTRY.map((a) => a.id);
    for (const adapter of [claude, copilot, codex, gemini, localLlm]) {
      expect(ids).toContain(adapter.name);
    }
  });
});
