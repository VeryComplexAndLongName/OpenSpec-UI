// Where a named configuration sits in an agent's own effort range.
//
// `max` is not a value `codex-cli` accepts and `none` is not one
// `claude-cli` accepts, so a configuration storing either is wrong for
// some agent the moment it is applied — and shipping one the validator
// would then reject is shipping a configuration the product refuses.
//
// So a configuration declares a level and the value is resolved here,
// against the agent that stage actually uses.
//
// Zero Node imports: `webui` resolves these to show what a configuration
// would set before it is applied. Same reason `harness-dispatch.ts` and
// `custom-agent-family.ts` are their own leaf modules.

import { HARNESS_AGENT_CAPABILITIES, type HarnessEffort } from "./harness-step-agent.js";

/** Four positions in an agent's range, widest to tightest. Four is the
 * number a person can hold; a fifth to fit the widest vocabulary would
 * make the narrow ones worse. */
export type HarnessEffortLevel = "highest" | "high" | "medium" | "lowest";

export const HARNESS_EFFORT_LEVELS: readonly HarnessEffortLevel[] = ["highest", "high", "medium", "lowest"];

/** Where each level sits, as a fraction of the range: evenly spaced,
 * ends included. `lowest` is the bottom rather than a fraction of it, so
 * an agent offering `none` gets `none` for its cheapest configuration
 * rather than something above it.
 *
 * Even thirds rather than the tidier-looking 1 / 0.75 / 0.5 / 0: over
 * `codex-cli`'s four values those two land on the same one, so two
 * configurations would have differed in nothing while a value in the
 * middle of the vocabulary was never reachable. Checked against every
 * registered agent — see presets-by-effort's design.md for the table. */
const POSITION: Readonly<Record<HarnessEffortLevel, number>> = {
  highest: 1,
  high: 2 / 3,
  medium: 1 / 3,
  lowest: 0,
};

export interface ResolvedEffort {
  /** Absent where the agent accepts no effort at all — five of the ten
   * registered. That is a fact about the agent, not a failure to
   * resolve. */
  effort?: HarnessEffort;
  /** What the agent accepts, so a caller can say why the answer is what
   * it is without looking it up again. */
  accepted: readonly HarnessEffort[];
}

/** The value a level means for one agent. */
export function resolveEffortLevel(agentId: string, level: HarnessEffortLevel): ResolvedEffort {
  const accepted = HARNESS_AGENT_CAPABILITIES[agentId]?.effort ?? [];
  if (accepted.length === 0) return { accepted };
  const index = Math.round(POSITION[level] * (accepted.length - 1));
  return { effort: accepted[index], accepted };
}

/** Which levels resolve alike for an agent.
 *
 * `codex-cli` accepts four values, and four levels over four values can
 * land two on the same one. Reported rather than hidden: two
 * configurations that differ in nothing should not be presented as a
 * choice. An agent accepting no effort is the extreme — every level
 * collapses, and only the ceilings differ. */
export function effortLevelCollisions(agentId: string): HarnessEffortLevel[][] {
  const byValue = new Map<string, HarnessEffortLevel[]>();
  for (const level of HARNESS_EFFORT_LEVELS) {
    const { effort } = resolveEffortLevel(agentId, level);
    const key = effort ?? "(none)";
    byValue.set(key, [...(byValue.get(key) ?? []), level]);
  }
  return [...byValue.values()].filter((levels) => levels.length > 1);
}
