// Pure type + helper, deliberately its own leaf module with zero
// non-type imports — same reasoning as harness-stage.ts/harness-
// dispatch.ts. `normalizeStepAgent` must be importable from
// `@openspec-ui/core/browser` (HarnessSettingsView.tsx renders a
// `stepAgents` entry that may have come from a hand-edited config in
// either form), but `harness-config.ts` itself has top-level
// `node:fs/promises`/`node:path` imports for its other exports —
// re-exporting a value (not just a type) FROM that module would force
// the browser bundle to actually load it at runtime, pulling those Node
// built-ins in with it (see harness-dispatch.ts's identical note).

import type { HarnessStage } from "./harness-stage.js";

/** Stage-runner id meaning "dispatch this stage to VS Code's own chat"
 * instead of spawning a CLI agent process — see
 * docs/adr/0016-harness-stage-dispatch-via-vscode-chat.md. */
export const VSCODE_CHAT_STEP_AGENT_ID = "vscode-chat";

/** A stage's entry names what runs that stage, either on its own (the
 * bare-string form, unchanged from before this capability) or together
 * with a model, reasoning effort, and/or spending cap. Widened, not
 * replaced — see harness-step-models design.md, "Widen the entry, keep
 * the string form working", and harness-step-effort-and-budget design.md
 * for `effort`/`budget`. */
export type HarnessStepAgent =
  | string
  | { agent: string; model?: string; effort?: HarnessEffort; budget?: HarnessStepBudget };
/** The subset of `HarnessStage` a `stepAgents` entry may name. `archive`
 * is deliberately excluded — it is a real stage (`CHAIN_STAGES` in
 * harness-chain-runner.ts still drives it), but a mechanical one that
 * never invokes an agent, so there is nothing for an entry to configure.
 * See openspec/changes/harness-mechanical-checks/design.md, "`stepAgents`
 * narrows; existing configurations are migrated" — a config that already
 * sets `stepAgents.archive` is read and has that entry dropped with a
 * warning (harness-config.ts), not rejected. */
export type HarnessStepAgentStage = Exclude<HarnessStage, "archive">;
export type HarnessStepAgents = Partial<Record<HarnessStepAgentStage, HarnessStepAgent>>;

/** Narrows a stage to one a `stepAgents` entry may name. A consumer
 * holding a plain `HarnessStage` — every dispatch and settings surface
 * does — needs this rather than an index, which the narrowed record
 * cannot accept. */
export function isHarnessStepAgentStage(stage: HarnessStage): stage is HarnessStepAgentStage {
  return stage !== "archive";
}

/** The entry for `stage`, or `undefined` when the stage is one no entry
 * can name. Keeping the `archive` case here, rather than at each call
 * site, is what stops `stepAgents.archive`'s removal from turning into
 * six subtly different guards. */
export function stepAgentFor(
  stepAgents: HarnessStepAgents | undefined,
  stage: HarnessStage,
): HarnessStepAgent | undefined {
  if (stepAgents === undefined || !isHarnessStepAgentStage(stage)) return undefined;
  return stepAgents[stage];
}

/** Allow-list of characters a model id may contain: cannot start with
 * `-` (so it can never be read as a second flag) and cannot contain
 * whitespace or quotes (so it can never become a shell/quoting escape)
 * — see harness-step-models design.md, "Validation is a closed
 * character set, not an escape". */
export const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** The union of every reasoning-effort value any registered agent
 * accepts, not the intersection — see harness-step-effort-and-budget
 * design.md, "Effort is validated per agent, not against one shared
 * union". Which subset a given agent actually accepts lives in
 * `HARNESS_AGENT_CAPABILITIES` below, not here. */
export type HarnessEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export const HARNESS_EFFORT_VALUES: readonly HarnessEffort[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

/** A spending cap in one agent's own unit. Deliberately not a single
 * `budget: number` — see design.md, "Budget values are agent-native and
 * named for their unit". Distinct from `HarnessConfig.budget`
 * (harness-config.ts), which caps an entire chain across stages; this
 * one is passed straight through to a single CLI invocation. */
export interface HarnessStepBudget {
  maxCostUsd?: number;
  maxAiCredits?: number;
}

/** GitHub Copilot CLI's own documented minimum for `--max-ai-credits` —
 * see proposal.md's investigation table. A value below this is rejected
 * at configuration time (harness-config.ts) rather than left for the
 * CLI to reject minutes into a run. */
export const COPILOT_MIN_AI_CREDITS = 30;

/** What one registered agent id can express on its command line, for
 * reasoning effort and spending cap. The single source of truth both
 * `harness-config.ts` (rejects a setting the agent can't honour) and
 * each adapter in `agents/*.ts` (renders the flag) read — see tasks.md
 * 1.4: "do not duplicate the knowledge in an adapter and in the
 * validator". An id absent from `effort`/`budgetField` means that agent
 * has no mechanism for it at all. */
export interface HarnessAgentCapabilities {
  /** Effort values this agent's CLI accepts; absent or empty means no
   * command-line reasoning-effort mechanism exists. */
  effort?: readonly HarnessEffort[];
  /** Which `HarnessStepBudget` field this agent's CLI honours; absent
   * means the agent has no spending-cap mechanism. */
  budgetField?: "maxCostUsd" | "maxAiCredits";
}

/** Live-verified for `claude-cli`/`copilot-cli` (`--help` on this
 * machine, 2026-09-02, see proposal.md's investigation table).
 * `codex-cli`'s accepted levels are taken from OpenAI's documented
 * `model_reasoning_effort` config values, not verified live here — see
 * tasks.md 6.7, outstanding. `gemini-cli` and `local-llm` have no
 * mechanism for either setting and are deliberately left with empty
 * capabilities so any configured value is refused.
 *
 * `copilot-cli-acp`/`claude-cli-acp` are derived from their plain
 * counterparts: each ACP adapter spawns the same binary with the same
 * `--effort`/`--max-ai-credits`/`--max-budget-usd` flags (see
 * agents/copilot-acp.ts and agents/claude-acp.ts) and is permitted the
 * same way in default-runners.ts, so the capability set cannot honestly
 * differ. `codex-cli-acp`/`gemini-cli-acp` get an explicit empty entry —
 * their adapters deliberately render neither flag (see agents/codex-
 * acp.ts and agents/gemini-acp.ts's own header comments) — an absent row
 * is what let the plain/ACP tables drift apart before this change (see
 * acp-agent-capabilities proposal.md). */
export const HARNESS_AGENT_CAPABILITIES: Readonly<Record<string, HarnessAgentCapabilities>> = {
  "claude-cli": { effort: ["low", "medium", "high", "xhigh", "max"], budgetField: "maxCostUsd" },
  "copilot-cli": { effort: ["none", "minimal", "low", "medium", "high", "xhigh", "max"], budgetField: "maxAiCredits" },
  "codex-cli": { effort: ["minimal", "low", "medium", "high"] },
  "gemini-cli": {},
  "local-llm": {},
  [VSCODE_CHAT_STEP_AGENT_ID]: {},
  "copilot-cli-acp": { effort: ["none", "minimal", "low", "medium", "high", "xhigh", "max"], budgetField: "maxAiCredits" },
  "claude-cli-acp": { effort: ["low", "medium", "high", "xhigh", "max"], budgetField: "maxCostUsd" },
  "codex-cli-acp": {},
  "gemini-cli-acp": {},
};

/** Normalizes either form of a `HarnessStepAgents` entry to `{ agent,
 * model?, effort?, budget? }` — the single place that knows both shapes
 * exist, so no consumer has to. */
export function normalizeStepAgent(
  entry: HarnessStepAgent,
): { agent: string; model?: string; effort?: HarnessEffort; budget?: HarnessStepBudget } {
  if (typeof entry === "string") return { agent: entry };
  return { agent: entry.agent, model: entry.model, effort: entry.effort, budget: entry.budget };
}
