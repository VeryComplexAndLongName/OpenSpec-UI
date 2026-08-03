// Готовая сборка реестра `AgentRunner` с allowlist'ом по умолчанию —
// переиспользуется и `server`, и `extension` (оба — тонкие хосты
// `execution-core`, не должны придумывать эту конфигурацию по отдельности,
// см. ADR 0001 п.1: "единственный источник правды по поведению — core").
//
// Allowlist здесь лишь формализует то, что каждый адаптер и так
// детерминированно строит в своём `buildInvocation()` (см. agents/*.ts) —
// это не бизнес-логика хоста, а конфигурация уже существующего механизма
// security.ts.

import { ClaudeCliAdapter } from "./agents/claude.js";
import { CopilotCliAdapter } from "./agents/copilot.js";
import { CodexCliAdapter } from "./agents/codex.js";
import { GeminiCliAdapter } from "./agents/gemini.js";
import { LocalLlmAdapter } from "./agents/local-llm.js";
import { createAgentRunner, type AgentRunner } from "./agent-runner.js";
import type { AllowlistConfig, AuditLog } from "./security.js";
import { InMemoryAuditLog } from "./security.js";

export interface DefaultRunnersConfig {
  workspaceRoot: string;
  localLlmBaseUrl?: string;
  localLlmModel?: string;
  auditLog?: AuditLog;
}

export const DEFAULT_AGENT_ID = "claude-cli";

function exact(expected: string[]): (args: string[]) => boolean {
  return (args) => args.length === expected.length && args.every((a, i) => a === expected[i]);
}

/** Allowlist по умолчанию: разрешает ровно то, что каждый адаптер и так
 * строит сам (см. `buildInvocation()` каждого из них), не более широкий
 * набор. */
export function buildDefaultAllowlist(): AllowlistConfig {
  return {
    "claude-cli": [{ executable: "claude", argsAllowed: exact(["-p", "--output-format", "text"]) }],
    "copilot-cli": [{ executable: "copilot", argsAllowed: exact(["-p", "--allow-all-tools"]) }],
    "codex-cli": [{ executable: "codex", argsAllowed: exact(["exec", "--skip-git-repo-check"]) }],
    "gemini-cli": [{ executable: "gemini", argsAllowed: exact(["--yolo"]) }],
    "local-llm": [{ executable: "__http__", argsAllowed: (args) => args[1] === "POST" }],
  };
}

export function buildDefaultAgentRunners(config: DefaultRunnersConfig): Map<string, AgentRunner> {
  const allowlist = buildDefaultAllowlist();
  const auditLog = config.auditLog ?? new InMemoryAuditLog();
  const runnerOptions = { workspaceRoot: config.workspaceRoot, allowlist, auditLog };

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
