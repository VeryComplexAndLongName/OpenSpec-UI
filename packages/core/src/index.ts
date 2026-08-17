// Точка входа @openspec-ui/core — единственный источник правды по поведению
// (см. docs/adr/0001-shared-core-two-delivery-targets.md). `server`/`extension`
// импортируют отсюда, не лезут во внутренние модули напрямую.

export * from "./protocol.js";
export * from "./agent-runner.js";
export * from "./security.js";
export * from "./change-state.js";
export * from "./change-editor-store.js";
export * from "./openspec.js";
export * from "./git.js";
export * from "./workbench.js";
export * from "./task-templates.js";
export * from "./template-catalog.js";
export * from "./process-scheduler.js";
export * from "./checkpoint.js";
export * from "./workbench-run-journal.js";
export * from "./workbench-recovery.js";
export * from "./agent-detection.js";

export { ClaudeCliAdapter } from "./agents/claude.js";
export { CopilotCliAdapter } from "./agents/copilot.js";
export { CodexCliAdapter } from "./agents/codex.js";
export { GeminiCliAdapter } from "./agents/gemini.js";
export { LocalLlmAdapter, type LocalLlmAdapterOptions } from "./agents/local-llm.js";
export { AGENT_REGISTRY, type AgentDescriptor } from "./agents/registry.js";

export {
  DEFAULT_AGENT_ID,
  buildDefaultAllowlist,
  buildDefaultAgentRunners,
  resolveRunner,
  type DefaultRunnersConfig,
} from "./default-runners.js";
