// Recommendations drawn from what has actually happened in this
// workspace, rather than from an intent chosen in advance.
//
// The named configurations in `harness-templates.ts` are decided before
// any workspace exists, so they are titled by what they are *for*. These
// are decided by the workspace and are titled by what they *are*: the
// cheapest, the fastest, the most likely to finish. The name is the
// conclusion; the observation beside it is what makes the conclusion
// arguable.
//
// Pure over an aggregate, like every other analysis in core.

import type { AgentRunGroup, WorkspaceRunStats } from "./workspace-run-stats.js";

export type RunRecommendationKind = "cheapest" | "fastest" | "most-likely-to-finish";

export interface RunRecommendation {
  kind: RunRecommendationKind;
  /** What this recommends, as a sentence a reader can act on. */
  title: string;
  /** Every agent that wins on this measure. More than one where they tie:
   * breaking a tie arbitrarily presents a fabricated distinction as a
   * finding. */
  agents: string[];
  /** The figure it won on, and what that figure rests on. */
  because: string;
}

/** Why a comparison was not offered. Reported rather than left silent:
 * "nothing can be compared yet" and "no comparison was attempted" are
 * different, and a box showing figures with no conclusion looks like the
 * second. */
export interface RunRecommendationGap {
  kind: RunRecommendationKind;
  reason: string;
}

export interface RunRecommendations {
  offered: RunRecommendation[];
  gaps: RunRecommendationGap[];
}

/** A group may win a superlative only if its figures are an answer rather
 * than a reading — which is what the aggregate's own threshold decides. */
function eligible(groups: readonly AgentRunGroup[]): AgentRunGroup[] {
  return groups.filter((group) => group.enough);
}

function winners<T>(
  candidates: readonly AgentRunGroup[],
  valueOf: (group: AgentRunGroup) => T | undefined,
  better: (left: T, right: T) => boolean,
): { agents: string[]; value: T } | undefined {
  let best: T | undefined;
  let agents: string[] = [];
  for (const group of candidates) {
    const value = valueOf(group);
    if (value === undefined) continue;
    if (best === undefined || better(value, best)) {
      best = value;
      agents = [group.agent];
    } else if (!better(best, value)) {
      // Equal on the measure — named alongside rather than dropped.
      agents.push(group.agent);
    }
  }
  return best === undefined ? undefined : { agents, value: best };
}

function runsBehind(candidates: readonly AgentRunGroup[], agents: readonly string[]): number {
  return candidates
    .filter((group) => agents.includes(group.agent))
    .reduce((total, group) => total + group.runs, 0);
}

/** Draws what the workspace's own runs support.
 *
 * A comparison needing two candidates is not offered with one. On this
 * repository, measured 2026-09-09, that silences the cost recommendation
 * entirely: one agent of three reports a cost at all, so "cheapest" would
 * name the only option and call it a comparison. */
export function recommendFromRunStats(stats: WorkspaceRunStats): RunRecommendations {
  const groups = eligible(stats.byAgent);
  const offered: RunRecommendation[] = [];
  const gaps: RunRecommendationGap[] = [];

  const withCost = groups.filter((group) => group.medianCostUsd !== undefined);
  if (withCost.length < 2) {
    gaps.push({
      kind: "cheapest",
      reason: withCost.length === 0
        ? `no agent has reported a cost across ${stats.runs} recorded run(s)`
        : `only ${withCost[0]?.agent} reports a cost, so there is nothing to compare it against`,
    });
  } else {
    const won = winners(withCost, (group) => group.medianCostUsd, (left, right) => left < right);
    if (won) {
      offered.push({
        kind: "cheapest",
        title: "Cheapest here",
        agents: won.agents,
        because: `$${won.value.toFixed(2)} median across ${runsBehind(withCost, won.agents)} run(s), against ${withCost.length} agents that report a cost`,
      });
    }
  }

  const withTime = groups.filter((group) => group.medianSeconds !== undefined);
  if (withTime.length < 2) {
    gaps.push({
      kind: "fastest",
      reason: `fewer than two agents have enough recorded runs to compare durations`,
    });
  } else {
    const won = winners(withTime, (group) => group.medianSeconds, (left, right) => left < right);
    if (won) {
      offered.push({
        kind: "fastest",
        title: "Fastest here",
        agents: won.agents,
        because: `${(won.value / 60).toFixed(1)} min median across ${runsBehind(withTime, won.agents)} run(s)`,
      });
    }
  }

  if (groups.length < 2) {
    gaps.push({
      kind: "most-likely-to-finish",
      reason: `fewer than two agents have enough recorded runs to compare`,
    });
  } else {
    const won = winners(groups, (group) => group.runs === 0 ? undefined : group.completed / group.runs, (left, right) => left > right);
    if (won) {
      const behind = groups.filter((group) => won.agents.includes(group.agent));
      const completed = behind.reduce((total, group) => total + group.completed, 0);
      const total = behind.reduce((sum, group) => sum + group.runs, 0);
      offered.push({
        kind: "most-likely-to-finish",
        title: "Most likely to finish",
        agents: won.agents,
        because: `${completed} of ${total} run(s) completed`,
      });
    }
  }

  return { offered, gaps };
}
