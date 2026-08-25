// Registry of registered AgentRunner adapters — the single place that
// lists the available agents by their `AgentAdapter.name` identifier.
// `webui` builds the agent selection in the AI panel from this registry,
// not from its own hardcoded list (see shared-ui tasks.md 5.1).

export interface AgentDescriptor {
  /** Matches the `AgentAdapter.name` of the corresponding adapter. */
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
