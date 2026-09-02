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

export interface AgentDescriptor {
  /** Matches the `AgentAdapter.name` of the corresponding adapter. */
  id: string;
  label: string;
  /** The CLI flag this adapter passes a model with; absent means this
   * adapter accepts no model (see harness-step-models design.md). */
  modelFlag?: string;
}

export const AGENT_REGISTRY: readonly AgentDescriptor[] = [
  { id: "claude-cli", label: "Claude CLI", modelFlag: "--model" },
  { id: "copilot-cli", label: "GitHub Copilot CLI", modelFlag: "--model" },
  { id: "codex-cli", label: "Codex CLI" },
  { id: "gemini-cli", label: "Gemini CLI" },
  { id: "local-llm", label: "Local LLM (OpenAI-compatible)" },
  // ACP-flavored adapters (acp-agent-adapters) — additional entries, not
  // replacements for the four above (see this file's header comment).
  { id: "copilot-cli-acp", label: "GitHub Copilot CLI (ACP)", modelFlag: "--model" },
  { id: "gemini-cli-acp", label: "Gemini CLI (ACP)" },
  { id: "codex-cli-acp", label: "Codex CLI (ACP)" },
  // Label states the limitation inline, not just in the picker's own
  // copy (webui's AiPanel.tsx) — see design.md's risk mitigation
  // "the UI presenting this adapter must say so explicitly ... not leave
  // it to be discovered" and claude-acp.ts's own header comment for why.
  { id: "claude-cli-acp", label: "Claude CLI (ACP) — progress only, no permission gate", modelFlag: "--model" },
];

/** Agent used when a `Command` does not specify `agentId`. Lives here
 * (not `default-runners.ts`) because it has no Node-only dependencies, so
 * it can be re-exported from `browser.ts` for the UI's agent picker. */
export const DEFAULT_AGENT_ID = "claude-cli";
