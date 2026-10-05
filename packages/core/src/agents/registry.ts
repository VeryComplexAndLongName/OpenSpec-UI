// Registry of registered AgentRunner adapters — the single place that
// lists the available agents by their `AgentAdapter.name` identifier.
// `webui` builds the agent selection in the AI panel from this registry,
// not from its own hardcoded list (see shared-ui tasks.md 5.1).
//
// ACP-flavored adapter id scheme (resolves acp-agent-adapters design.md's
// "Exact registry id / naming scheme" Open Question): each of the four
// ACP-flavored adapters gets a sibling id formed by appending `-acp` to
// its raw-text counterpart's id (`copilot-cli` -> `copilot-cli-acp`, and
// likewise for `gemini-cli`/`codex-cli`/`claude-cli`) — a separate
// registry entry, not a `variant` field on the existing one, per
// design.md's "ACP-flavored adapters are new, additional AgentAdapters,
// not replacements".
//
// Harness config strictness adds `vscode-chat` as a step-runner id (see
// `VSCODE_CHAT_STEP_AGENT_ID` in harness-step-agent.ts): this name is a
// delivery target, not a model family, so its meaning is explicit in the
// config entry itself ("dispatch stage to VS Code chat") and avoids
// implying that a CLI process will run.

/** Who serves an agent's model: what a change's files are sent to when it
 * runs. A move between two is a provider change (the-supervisor-changes-agents). */
export type AgentProvider = "anthropic" | "github" | "openai" | "google" | "deepseek" | "local";

export interface AgentDescriptor {
  /** Matches the `AgentAdapter.name` of the corresponding adapter. */
  id: string;
  label: string;
  /** Who serves its model (the-supervisor-changes-agents). */
  provider: AgentProvider;
  /** The CLI flag this adapter passes a model with (see harness-step-models
   * design.md). */
  modelFlag?: string;
  /** Whether a stage may name a model for this agent: true for every agent
   * with a `modelFlag`, and for the local LLM agents, which take the model
   * in their request rather than on a command line
   * (local-llm-codes-in-process). Read through `acceptsModel`. */
  takesModel?: boolean;
  /** The CLI flag this adapter passes a custom agent with — a named
   * preset the person defined themselves. Absent means this adapter
   * accepts none, and offering one for it would be a setting nothing
   * reads. See custom-agents-are-visible. */
  customAgentFlag?: string;
}

export const AGENT_REGISTRY: readonly AgentDescriptor[] = [
  { provider: "anthropic", id: "claude-cli", label: "Claude CLI", modelFlag: "--model", customAgentFlag: "--agent" },
  { provider: "github", id: "copilot-cli", label: "GitHub Copilot CLI", modelFlag: "--model", customAgentFlag: "--agent" },
  { provider: "openai", id: "codex-cli", label: "Codex CLI" },
  { provider: "google", id: "gemini-cli", label: "Gemini CLI" },
  { provider: "local", id: "local-llm", label: "Local LLM (OpenAI-compatible)", takesModel: true },
  // Runs inside the product: nothing to install (ADR 0038).
  { provider: "local", id: "local-llm-acp", label: "Local LLM agent (OpenAI-compatible, built in)", takesModel: true },
  // ACP-flavored adapters (acp-agent-adapters) — additional entries, not
  // replacements for the four above (see this file's header comment).
  { provider: "github", id: "copilot-cli-acp", label: "GitHub Copilot CLI (ACP)", modelFlag: "--model", customAgentFlag: "--agent" },
  { provider: "google", id: "gemini-cli-acp", label: "Gemini CLI (ACP)" },
  { provider: "openai", id: "codex-cli-acp", label: "Codex CLI (ACP)" },
  // DeepSeek through its own CLI's ACP profile (deepseek-joins-as-an-acp-agent).
  { provider: "deepseek", id: "deepseek-cli-acp", label: "DeepSeek CLI (ACP)" },
  // Label states the limitation inline, not just in the picker's own
  // copy (webui's AiPanel.tsx) — see design.md's risk mitigation
  // "the UI presenting this adapter must say so explicitly ... not leave
  // it to be discovered" and claude-acp.ts's own header comment for why.
  { provider: "anthropic", id: "claude-cli-acp", label: "Claude CLI (ACP) — progress only, no permission gate", modelFlag: "--model", customAgentFlag: "--agent" },
];

/** Whether a stage may name a model for `descriptor`'s agent. */
export function acceptsModel(descriptor: AgentDescriptor | undefined): boolean {
  return descriptor !== undefined && (descriptor.modelFlag !== undefined || descriptor.takesModel === true);
}

/** Agent used when a `Command` does not specify `agentId`. Lives here
 * (not `default-runners.ts`) because it has no Node-only dependencies, so
 * it can be re-exported from `browser.ts` for the UI's agent picker. */
export const DEFAULT_AGENT_ID = "claude-cli";
