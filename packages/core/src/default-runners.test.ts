import { describe, expect, it } from "vitest";
import { checkAllowlist } from "./security.js";
import { buildDefaultAgentRunners, buildDefaultAllowlist, DEFAULT_AGENT_ID, resolveRunner } from "./default-runners.js";
import { AGENT_REGISTRY } from "./agents/registry.js";
import { ClaudeCliAdapter } from "./agents/claude.js";
import { ClaudeCliAcpAdapter } from "./agents/claude-acp.js";
import { CopilotCliAdapter } from "./agents/copilot.js";
import { CopilotCliAcpAdapter } from "./agents/copilot-acp.js";
import { CodexCliAdapter } from "./agents/codex.js";
import { CodexCliAcpAdapter } from "./agents/codex-acp.js";
import { GeminiCliAdapter } from "./agents/gemini.js";
import { GeminiCliAcpAdapter } from "./agents/gemini-acp.js";
import { LocalLlmAdapter } from "./agents/local-llm.js";
import type { Command } from "./protocol.js";

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("buildDefaultAllowlist", () => {
  it("allows exactly what each real adapter's buildInvocation() produces", () => {
    const allowlist = buildDefaultAllowlist();

    const claudeInvocation = new ClaudeCliAdapter().buildInvocation(command);
    expect(checkAllowlist("claude-cli", claudeInvocation, allowlist).allowed).toBe(true);

    const copilotInvocation = new CopilotCliAdapter().buildInvocation(command);
    expect(checkAllowlist("copilot-cli", copilotInvocation, allowlist).allowed).toBe(true);

    const codexInvocation = new CodexCliAdapter().buildInvocation(command);
    expect(checkAllowlist("codex-cli", codexInvocation, allowlist).allowed).toBe(true);

    const geminiInvocation = new GeminiCliAdapter().buildInvocation(command);
    expect(checkAllowlist("gemini-cli", geminiInvocation, allowlist).allowed).toBe(true);

    const localLlmInvocation = new LocalLlmAdapter({ baseUrl: "http://x", model: "m" }).buildInvocation(command);
    expect(checkAllowlist("local-llm", localLlmInvocation, allowlist).allowed).toBe(true);
  });

  it("allows exactly what each real ACP-flavored adapter's buildInvocation() produces", () => {
    const allowlist = buildDefaultAllowlist();

    const copilotAcpInvocation = new CopilotCliAcpAdapter().buildInvocation(command);
    expect(checkAllowlist("copilot-cli-acp", copilotAcpInvocation, allowlist).allowed).toBe(true);

    const geminiAcpInvocation = new GeminiCliAcpAdapter().buildInvocation(command);
    expect(checkAllowlist("gemini-cli-acp", geminiAcpInvocation, allowlist).allowed).toBe(true);

    const codexAcpInvocation = new CodexCliAcpAdapter().buildInvocation(command);
    expect(checkAllowlist("codex-cli-acp", codexAcpInvocation, allowlist).allowed).toBe(true);

    const claudeAcpInvocation = new ClaudeCliAcpAdapter().buildInvocation(command);
    expect(checkAllowlist("claude-cli-acp", claudeAcpInvocation, allowlist).allowed).toBe(true);
  });

  it("rejects copilot-cli-acp's invocation with --allow-all-tools appended (that flag belongs only to the raw-text adapter)", () => {
    const allowlist = buildDefaultAllowlist();
    const decision = checkAllowlist(
      "copilot-cli-acp",
      { kind: "process", executable: "copilot", args: ["--acp", "--allow-all-tools"] },
      allowlist,
    );
    expect(decision.allowed).toBe(false);
  });

  it("rejects claude-cli-acp's invocation missing --dangerously-skip-permissions", () => {
    const allowlist = buildDefaultAllowlist();
    const decision = checkAllowlist(
      "claude-cli-acp",
      {
        kind: "process",
        executable: "claude",
        args: ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose"],
      },
      allowlist,
    );
    expect(decision.allowed).toBe(false);
  });

  it("rejects an invocation with extra/different args than the adapter builds", () => {
    const allowlist = buildDefaultAllowlist();
    const decision = checkAllowlist(
      "claude-cli",
      { kind: "process", executable: "claude", args: ["-p", "--dangerously-skip-permissions"] },
      allowlist,
    );
    expect(decision.allowed).toBe(false);
  });

  it("allows the model form for claude-cli", () => {
    const allowlist = buildDefaultAllowlist();
    const claudeInvocation = new ClaudeCliAdapter().buildInvocation({ ...command, model: "claude-haiku-4-5" });
    expect(checkAllowlist("claude-cli", claudeInvocation, allowlist).allowed).toBe(true);
  });

  const baseClaudeArgs = ["-p", "--output-format", "text", "--dangerously-skip-permissions"];

  it("rejects an argv carrying a second --model", () => {
    const allowlist = buildDefaultAllowlist();
    const decision = checkAllowlist(
      "claude-cli",
      { kind: "process", executable: "claude", args: [...baseClaudeArgs, "--model", "m1", "--model", "m2"] },
      allowlist,
    );
    expect(decision.allowed).toBe(false);
  });

  it("rejects a --model with no value", () => {
    const allowlist = buildDefaultAllowlist();
    const decision = checkAllowlist(
      "claude-cli",
      { kind: "process", executable: "claude", args: [...baseClaudeArgs, "--model"] },
      allowlist,
    );
    expect(decision.allowed).toBe(false);
  });

  it("rejects a model value failing the pattern", () => {
    const allowlist = buildDefaultAllowlist();
    const decision = checkAllowlist(
      "claude-cli",
      { kind: "process", executable: "claude", args: [...baseClaudeArgs, "--model", "-bad model"] },
      allowlist,
    );
    expect(decision.allowed).toBe(false);
  });

  describe("effort and budget (harness-step-effort-and-budget)", () => {
    const baseCopilotArgs = ["-p", "--allow-all-tools"];

    it("allows claude-cli invoked with --effort and --max-budget-usd via the real adapter", () => {
      const allowlist = buildDefaultAllowlist();
      const invocation = new ClaudeCliAdapter().buildInvocation({ ...command, effort: "high", budget: { maxCostUsd: 5 } });
      expect(checkAllowlist("claude-cli", invocation, allowlist).allowed).toBe(true);
    });

    it("allows copilot-cli invoked with --effort and --max-ai-credits via the real adapter", () => {
      const allowlist = buildDefaultAllowlist();
      const invocation = new CopilotCliAdapter().buildInvocation({ ...command, effort: "none", budget: { maxAiCredits: 30 } });
      expect(checkAllowlist("copilot-cli", invocation, allowlist).allowed).toBe(true);
    });

    it("allows codex-cli invoked with -c model_reasoning_effort=\"<level>\" via the real adapter", () => {
      const allowlist = buildDefaultAllowlist();
      const invocation = new CodexCliAdapter().buildInvocation({ ...command, effort: "low" });
      expect(checkAllowlist("codex-cli", invocation, allowlist).allowed).toBe(true);
    });

    it("rejects an unknown trailing flag after the expected prefix", () => {
      const allowlist = buildDefaultAllowlist();
      const decision = checkAllowlist(
        "claude-cli",
        { kind: "process", executable: "claude", args: [...baseClaudeArgs, "--unknown-flag", "x"] },
        allowlist,
      );
      expect(decision.allowed).toBe(false);
    });

    it("rejects an effort value outside claude-cli's accepted set", () => {
      const allowlist = buildDefaultAllowlist();
      const decision = checkAllowlist(
        "claude-cli",
        { kind: "process", executable: "claude", args: [...baseClaudeArgs, "--effort", "none"] },
        allowlist,
      );
      expect(decision.allowed).toBe(false);
    });

    it("rejects a non-numeric --max-budget-usd value", () => {
      const allowlist = buildDefaultAllowlist();
      const decision = checkAllowlist(
        "claude-cli",
        { kind: "process", executable: "claude", args: [...baseClaudeArgs, "--max-budget-usd", "a-lot"] },
        allowlist,
      );
      expect(decision.allowed).toBe(false);
    });

    it("rejects a negative --max-budget-usd value", () => {
      const allowlist = buildDefaultAllowlist();
      const decision = checkAllowlist(
        "claude-cli",
        { kind: "process", executable: "claude", args: [...baseClaudeArgs, "--max-budget-usd", "-5"] },
        allowlist,
      );
      expect(decision.allowed).toBe(false);
    });

    it("rejects an optional pair carried out of order (--effort before --model)", () => {
      const allowlist = buildDefaultAllowlist();
      const decision = checkAllowlist(
        "claude-cli",
        { kind: "process", executable: "claude", args: [...baseClaudeArgs, "--effort", "high", "--model", "m"] },
        allowlist,
      );
      expect(decision.allowed).toBe(false);
    });

    it("rejects a non-integer --max-ai-credits value", () => {
      const allowlist = buildDefaultAllowlist();
      const decision = checkAllowlist(
        "copilot-cli",
        { kind: "process", executable: "copilot", args: [...baseCopilotArgs, "--max-ai-credits", "12.5"] },
        allowlist,
      );
      expect(decision.allowed).toBe(false);
    });

    it("rejects -c carrying any key other than model_reasoning_effort", () => {
      const allowlist = buildDefaultAllowlist();
      const decision = checkAllowlist(
        "codex-cli",
        { kind: "process", executable: "codex", args: ["exec", "--skip-git-repo-check", "-c", 'approval_policy="never"'] },
        allowlist,
      );
      expect(decision.allowed).toBe(false);
    });

    it("rejects -c model_reasoning_effort with a level codex does not accept", () => {
      const allowlist = buildDefaultAllowlist();
      const decision = checkAllowlist(
        "codex-cli",
        { kind: "process", executable: "codex", args: ["exec", "--skip-git-repo-check", "-c", 'model_reasoning_effort="max"'] },
        allowlist,
      );
      expect(decision.allowed).toBe(false);
    });

    it("rejects a second -c pair appended after a valid one", () => {
      const allowlist = buildDefaultAllowlist();
      const decision = checkAllowlist(
        "codex-cli",
        {
          kind: "process",
          executable: "codex",
          args: ["exec", "--skip-git-repo-check", "-c", 'model_reasoning_effort="low"', "-c", 'sandbox_mode="danger-full-access"'],
        },
        allowlist,
      );
      expect(decision.allowed).toBe(false);
    });
  });
});

describe("buildDefaultAgentRunners / resolveRunner", () => {
  it("builds a runner for every registered agent id, including the four ACP-flavored ones", () => {
    const runners = buildDefaultAgentRunners({ workspaceRoot: "/workspace/repo" });
    for (const id of AGENT_REGISTRY.map((a) => a.id)) {
      expect(runners.has(id)).toBe(true);
    }
  });

  it("resolveRunner falls back to DEFAULT_AGENT_ID when agentId is undefined", () => {
    const runners = buildDefaultAgentRunners({ workspaceRoot: "/workspace/repo" });
    expect(resolveRunner(runners, undefined)).toBe(runners.get(DEFAULT_AGENT_ID));
  });

  it("resolveRunner returns undefined for an unknown agentId", () => {
    const runners = buildDefaultAgentRunners({ workspaceRoot: "/workspace/repo" });
    expect(resolveRunner(runners, "does-not-exist")).toBeUndefined();
  });
});
