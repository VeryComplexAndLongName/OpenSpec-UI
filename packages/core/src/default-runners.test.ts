import { describe, expect, it } from "vitest";
import { checkAllowlist } from "./security.js";
import { buildDefaultAgentRunners, buildDefaultAllowlist, DEFAULT_AGENT_ID, resolveRunner } from "./default-runners.js";
import { ClaudeCliAdapter } from "./agents/claude.js";
import { CopilotCliAdapter } from "./agents/copilot.js";
import { CodexCliAdapter } from "./agents/codex.js";
import { GeminiCliAdapter } from "./agents/gemini.js";
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
});

describe("buildDefaultAgentRunners / resolveRunner", () => {
  it("builds a runner for every registered agent id", () => {
    const runners = buildDefaultAgentRunners({ workspaceRoot: "/workspace/repo" });
    for (const id of ["claude-cli", "copilot-cli", "codex-cli", "gemini-cli", "local-llm"]) {
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
