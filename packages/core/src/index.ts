// Entry point for @openspec-ui/core — the single source of truth for
// behavior (see docs/adr/0001-shared-core-two-delivery-targets.md).
// `server`/`extension` import from here, not directly from internal modules.

export * from "./protocol.js";
export * from "./agent-runner.js";
export * from "./security.js";
export * from "./change-state.js";
export * from "./change-editor-store.js";
export * from "./openspec.js";
export * from "./git.js";
export * from "./gh-pr-gateway.js";
export * from "./workbench.js";
export * from "./task-templates.js";
export * from "./task-checklist.js";
export * from "./mechanical-checks.js";
export * from "./version-info.js";
export * from "./template-catalog.js";
export * from "./repo-bootstrap.js";
export * from "./harness-config.js";
export * from "./harness-chain-runner.js";
export * from "./process-scheduler.js";
export * from "./workspace-lease.js";
export * from "./checkpoint.js";
export * from "./workbench-run-journal.js";
export * from "./workbench-recovery.js";
export * from "./agent-detection.js";
export * from "./changeset-reminder.js";
export * from "./change-timeline.js";
export * from "./stale-tasks.js";
export * from "./sprint-report.js";
export * from "./sprint-report-pdf.js";
export * from "./agent-usage.js";
export * from "./verified-agent-versions.js";
export * from "./usage-report.js";

export { ClaudeCliAdapter } from "./agents/claude.js";
export { CopilotCliAdapter } from "./agents/copilot.js";
export { CodexCliAdapter } from "./agents/codex.js";
export { GeminiCliAdapter } from "./agents/gemini.js";
export { LocalLlmAdapter, type LocalLlmAdapterOptions } from "./agents/local-llm.js";
export { AGENT_REGISTRY, type AgentDescriptor } from "./agents/registry.js";

// ACP-flavored adapters (acp-agent-adapters) — see agents/acp-session-driver.ts.
export { AcpSessionDriver } from "./agents/acp-session-driver.js";
export { CopilotCliAcpAdapter } from "./agents/copilot-acp.js";
export { GeminiCliAcpAdapter } from "./agents/gemini-acp.js";
export { CodexCliAcpAdapter } from "./agents/codex-acp.js";
export { ClaudeCliAcpAdapter } from "./agents/claude-acp.js";

export {
  DEFAULT_AGENT_ID,
  buildDefaultAllowlist,
  buildDefaultAgentRunners,
  resolveRunner,
  type DefaultRunnersConfig,
} from "./default-runners.js";
