import { describe, expect, it } from "vitest";
import { AGENT_REGISTRY } from "./registry.js";
import { ClaudeCliAdapter } from "./claude.js";
import { ClaudeCliAcpAdapter } from "./claude-acp.js";
import { CopilotCliAdapter } from "./copilot.js";
import { CopilotCliAcpAdapter } from "./copilot-acp.js";
import { CodexCliAdapter } from "./codex.js";
import { CodexCliAcpAdapter } from "./codex-acp.js";
import { GeminiCliAdapter } from "./gemini.js";
import { GeminiCliAcpAdapter } from "./gemini-acp.js";
import { LocalLlmAdapter } from "./local-llm.js";

describe("AGENT_REGISTRY", () => {
  it("has unique ids", () => {
    const ids = AGENT_REGISTRY.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches every adapter's actual AgentAdapter.name, including the four ACP-flavored adapters", () => {
    const claude = new ClaudeCliAdapter();
    const copilot = new CopilotCliAdapter();
    const codex = new CodexCliAdapter();
    const gemini = new GeminiCliAdapter();
    const localLlm = new LocalLlmAdapter({ baseUrl: "http://x", model: "m" });
    const claudeAcp = new ClaudeCliAcpAdapter();
    const copilotAcp = new CopilotCliAcpAdapter();
    const codexAcp = new CodexCliAcpAdapter();
    const geminiAcp = new GeminiCliAcpAdapter();

    const ids = AGENT_REGISTRY.map((a) => a.id);
    for (const adapter of [claude, copilot, codex, gemini, localLlm, claudeAcp, copilotAcp, codexAcp, geminiAcp]) {
      expect(ids).toContain(adapter.name);
    }
  });

  it("the ACP-flavored ids are the raw-text id plus '-acp', as siblings not replacements", () => {
    const ids = new Set(AGENT_REGISTRY.map((a) => a.id));
    for (const rawId of ["claude-cli", "copilot-cli", "codex-cli", "gemini-cli"]) {
      expect(ids.has(rawId)).toBe(true);
      expect(ids.has(`${rawId}-acp`)).toBe(true);
    }
  });
});
