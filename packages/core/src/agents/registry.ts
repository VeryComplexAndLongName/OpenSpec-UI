// Реестр зарегистрированных AgentRunner-адаптеров — единственное место, где
// перечислены доступные агенты по их `AgentAdapter.name`-идентификатору.
// `webui` строит выбор агента в AI-панели по этому реестру, а не по
// собственному захардкоженному списку (см. shared-ui tasks.md 5.1).

export interface AgentDescriptor {
  /** Совпадает с `AgentAdapter.name` соответствующего адаптера. */
  id: string;
  label: string;
}

export const AGENT_REGISTRY: readonly AgentDescriptor[] = [
  { id: "claude-cli", label: "Claude CLI" },
  { id: "copilot-cli", label: "GitHub Copilot CLI" },
  { id: "codex-cli", label: "Codex CLI" },
  { id: "gemini-cli", label: "Gemini CLI" },
  { id: "local-llm", label: "Local LLM (OpenAI-compatible)" },
];

/** Agent used when a `Command` does not specify `agentId`. Lives here
 * (not `default-runners.ts`) because it has no Node-only dependencies, so
 * it can be re-exported from `browser.ts` for the UI's agent picker. */
export const DEFAULT_AGENT_ID = "claude-cli";
