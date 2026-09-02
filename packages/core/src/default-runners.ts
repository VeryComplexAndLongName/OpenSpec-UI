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
import { ClaudeCliAcpAdapter } from "./agents/claude-acp.js";
import { CopilotCliAdapter } from "./agents/copilot.js";
import { CopilotCliAcpAdapter } from "./agents/copilot-acp.js";
import { CodexCliAdapter } from "./agents/codex.js";
import { CodexCliAcpAdapter } from "./agents/codex-acp.js";
import { GeminiCliAdapter } from "./agents/gemini.js";
import { GeminiCliAcpAdapter } from "./agents/gemini-acp.js";
import { LocalLlmAdapter } from "./agents/local-llm.js";
import { DEFAULT_AGENT_ID } from "./agents/registry.js";
import { HARNESS_AGENT_CAPABILITIES, MODEL_ID_PATTERN } from "./harness-config.js";
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

interface OptionalArg {
  flag: string;
  validate: (value: string) => boolean;
}

/** Permits `expected` exactly, or `expected` followed by any subset of
 * `optionalArgs`' flag+value pairs, each present or absent
 * independently but — when present — appearing in the exact order
 * `optionalArgs` lists them, with a value passing that pair's own
 * validator. Nothing else is permitted: an unknown flag, a flag out of
 * order, or a flag with no value / a value its validator rejects all
 * fail the whole match — see harness-step-effort-and-budget design.md,
 * "The allowlist grows to a set of validated optional pairs, still
 * closed". Generalizes harness-step-models' single-pair
 * `exactWithOptionalModel`. */
function exactWithOptionalArgs(expected: string[], optionalArgs: OptionalArg[]): (args: string[]) => boolean {
  return (args) => {
    if (args.length < expected.length) return false;
    if (!exact(expected)(args.slice(0, expected.length))) return false;

    let idx = expected.length;
    for (const { flag, validate } of optionalArgs) {
      if (idx >= args.length || args[idx] !== flag) continue;
      if (idx + 1 >= args.length || !validate(args[idx + 1] ?? "")) return false;
      idx += 2;
    }
    return idx === args.length;
  };
}

function isPositiveDecimal(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value) && Number(value) > 0;
}

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function effortValidator(agentId: string): (value: string) => boolean {
  const accepted: readonly string[] = HARNESS_AGENT_CAPABILITIES[agentId]?.effort ?? [];
  return (value) => accepted.includes(value);
}

/** Matches `-c model_reasoning_effort="<level>"` for exactly codex's own
 * accepted levels — task 4.3: "match the whole pair including the key
 * ... and nothing else beginning with -c". Any other `-c key=value`
 * (sandbox mode, approval policy, provider, ...) fails this validator
 * and so fails the whole invocation, closing the rest of codex's
 * configuration surface off from this allowlist. */
function codexReasoningEffortValidator(): (value: string) => boolean {
  const accepted: readonly string[] = HARNESS_AGENT_CAPABILITIES["codex-cli"]?.effort ?? [];
  return (value) => accepted.some((level) => value === `model_reasoning_effort="${level}"`);
}

/** Default allowlist: permits exactly what each adapter already builds
 * itself (see each one's `buildInvocation()`), not a broader set. */
export function buildDefaultAllowlist(): AllowlistConfig {
  return {
    "claude-cli": [{
      executable: "claude",
      argsAllowed: exactWithOptionalArgs(["-p", "--output-format", "text", "--dangerously-skip-permissions"], [
        { flag: "--model", validate: (v) => MODEL_ID_PATTERN.test(v) },
        { flag: "--effort", validate: effortValidator("claude-cli") },
        { flag: "--max-budget-usd", validate: isPositiveDecimal },
      ]),
    }],
    "copilot-cli": [{
      executable: "copilot",
      argsAllowed: exactWithOptionalArgs(["-p", "--allow-all-tools"], [
        { flag: "--model", validate: (v) => MODEL_ID_PATTERN.test(v) },
        { flag: "--effort", validate: effortValidator("copilot-cli") },
        { flag: "--max-ai-credits", validate: isPositiveInteger },
      ]),
    }],
    "codex-cli": [{
      executable: "codex",
      argsAllowed: exactWithOptionalArgs(["exec", "--skip-git-repo-check"], [
        { flag: "-c", validate: codexReasoningEffortValidator() },
      ]),
    }],
    "gemini-cli": [{ executable: "gemini", argsAllowed: exact(["--yolo"]) }],
    "local-llm": [{ executable: "__http__", argsAllowed: (args) => args[1] === "POST" }],
    // ACP-flavored adapters (acp-agent-adapters) — mirrors each one's own
    // buildInvocation(), same as every entry above. No `--allow-all-
    // tools`/`--yolo` counterpart to permit here: see copilot-acp.ts's and
    // gemini-acp.ts's own header comments for why those adapters never
    // render such a flag in the first place.
    "copilot-cli-acp": [{
      executable: "copilot",
      argsAllowed: exactWithOptionalArgs(["--acp"], [
        { flag: "--model", validate: (v) => MODEL_ID_PATTERN.test(v) },
        { flag: "--effort", validate: effortValidator("copilot-cli") },
        { flag: "--max-ai-credits", validate: isPositiveInteger },
      ]),
    }],
    "gemini-cli-acp": [{ executable: "gemini", argsAllowed: exact(["--experimental-acp"]) }],
    "codex-cli-acp": [{ executable: "codex-acp", argsAllowed: exact([]) }],
    "claude-cli-acp": [{
      executable: "claude",
      argsAllowed: exactWithOptionalArgs(
        ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions"],
        [
          { flag: "--model", validate: (v) => MODEL_ID_PATTERN.test(v) },
          { flag: "--effort", validate: effortValidator("claude-cli") },
          { flag: "--max-budget-usd", validate: isPositiveDecimal },
        ],
      ),
    }],
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
    "copilot-cli-acp": new CopilotCliAcpAdapter(),
    "gemini-cli-acp": new GeminiCliAcpAdapter(),
    "codex-cli-acp": new CodexCliAcpAdapter(),
    "claude-cli-acp": new ClaudeCliAcpAdapter(),
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
