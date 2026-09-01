// Ready-made build of the `AgentRunner` registry with a default allowlist —
// reused by both `server` and `extension` (both are thin hosts over
// `execution-core` and must not invent this configuration separately,
// see ADR 0001 item 1: "single source of truth for behavior is core").
//
// The allowlist here just formalizes what each adapter already
// deterministically builds in its own `buildInvocation()` (see agents/*.ts) —
// this is not host business logic, it is configuration of the already
// existing security.ts mechanism.

import { ClaudeCliAdapter } from "./agents/claude.js";
import { CopilotCliAdapter } from "./agents/copilot.js";
import { CodexCliAdapter } from "./agents/codex.js";
import { GeminiCliAdapter } from "./agents/gemini.js";
import { LocalLlmAdapter } from "./agents/local-llm.js";
import { DEFAULT_AGENT_ID } from "./agents/registry.js";
import { MODEL_ID_PATTERN } from "./harness-config.js";
import { createAgentRunner, type AgentRunner } from "./agent-runner.js";
import type { AllowlistConfig, AuditLog } from "./security.js";
import { InMemoryAuditLog } from "./security.js";

export interface DefaultRunnersConfig {
  workspaceRoot: string;
  localLlmBaseUrl?: string;
  localLlmModel?: string;
  auditLog?: AuditLog;
  allowExternalCwd?: boolean;
}

export { DEFAULT_AGENT_ID };

function exact(expected: string[]): (args: string[]) => boolean {
  return (args) => args.length === expected.length && args.every((a, i) => a === expected[i]);
}

/** Permits `expected` exactly, or `expected` followed by exactly the
 * given `modelFlag` and one value matching `MODEL_ID_PATTERN` —
 * nothing else (see harness-step-models design.md, "The allowlist
 * matcher admits one pair, positionally last"). */
function exactWithOptionalModel(expected: string[], modelFlag: string): (args: string[]) => boolean {
  return (args) => {
    if (args.length === expected.length) return exact(expected)(args);
    if (args.length !== expected.length + 2) return false;
    return (
      exact(expected)(args.slice(0, expected.length)) &&
      args[expected.length] === modelFlag &&
      MODEL_ID_PATTERN.test(args[expected.length + 1] ?? "")
    );
  };
}

/** Default allowlist: permits exactly what each adapter already builds
 * itself (see each one's `buildInvocation()`), not a broader set. */
export function buildDefaultAllowlist(): AllowlistConfig {
  return {
    "claude-cli": [{
      executable: "claude",
      argsAllowed: exactWithOptionalModel(["-p", "--output-format", "text", "--dangerously-skip-permissions"], "--model"),
    }],
    "copilot-cli": [{
      executable: "copilot",
      argsAllowed: exactWithOptionalModel(["-p", "--allow-all-tools"], "--model"),
    }],
    "codex-cli": [{ executable: "codex", argsAllowed: exact(["exec", "--skip-git-repo-check"]) }],
    "gemini-cli": [{ executable: "gemini", argsAllowed: exact(["--yolo"]) }],
    "local-llm": [{ executable: "__http__", argsAllowed: (args) => args[1] === "POST" }],
  };
}

export function buildDefaultAgentRunners(config: DefaultRunnersConfig): Map<string, AgentRunner> {
  const allowlist = buildDefaultAllowlist();
  const auditLog = config.auditLog ?? new InMemoryAuditLog();
  const runnerOptions = {
    workspaceRoot: config.workspaceRoot,
    allowlist,
    auditLog,
    allowExternalCwd: config.allowExternalCwd,
  };

  const adapters = {
    "claude-cli": new ClaudeCliAdapter(),
    "copilot-cli": new CopilotCliAdapter(),
    "codex-cli": new CodexCliAdapter(),
    "gemini-cli": new GeminiCliAdapter(),
    "local-llm": new LocalLlmAdapter({
      baseUrl: config.localLlmBaseUrl ?? "http://localhost:30000",
      model: config.localLlmModel ?? "default",
    }),
  };

  const runners = new Map<string, AgentRunner>();
  for (const [id, adapter] of Object.entries(adapters)) {
    runners.set(id, createAgentRunner(adapter, runnerOptions));
  }
  return runners;
}

export function resolveRunner(runners: Map<string, AgentRunner>, agentId: string | undefined): AgentRunner | undefined {
  return runners.get(agentId ?? DEFAULT_AGENT_ID);
}
