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
 * second.
 *
 * The reason distinguishes three nothings, because they are three
 * different facts and only the first is answered by an agent starting
 * to report: nothing reported the measure at all; something reported it
 * but every group rests on fewer runs than the threshold; exactly one
 * group is eligible and has nothing to compare against. Saying "no
 * agent has reported a cost" of four runs that each reported one is a
 * reason that is simply false, which is what this said before
 * quality-is-charged-to-the-agent-whose-work-was-checked. */
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

/** The reason a measure produced no comparison, said as the state it
 * actually is.
 *
 * `reporting` is every group that reported the measure at all, thin or
 * not; `eligible` is the subset that also clears the run threshold. The
 * three branches are the three nothings — see `RunRecommendationGap`. */
function gapReason(
  measure: { nothingReported: string; tooFew: (reporting: number) => string; onlyOne: (agent: string) => string },
  reporting: readonly AgentRunGroup[],
  eligible: readonly AgentRunGroup[],
): string {
  if (reporting.length === 0) return measure.nothingReported;
  if (eligible.length === 0) return measure.tooFew(reporting.length);
  return measure.onlyOne(eligible[0]?.agent ?? "");
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
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

  // Both lists, not just the eligible one. Filtering to the eligible
  // groups before writing the reason is what made four runs that each
  // reported a cost read as "no agent has reported a cost": every one of
  // them was thin, so the list the reason was drawn from was empty.
  const reportingCost = stats.byAgent.filter((group) => group.medianCostUsd !== undefined);
  const withCost = groups.filter((group) => group.medianCostUsd !== undefined);
  if (withCost.length < 2) {
    gaps.push({
      kind: "cheapest",
      reason: gapReason({
        nothingReported: `no agent has reported a cost across ${plural(stats.runs, "recorded run")}`,
        tooFew: (reporting) => `${plural(reporting, "agent")} reported a cost, but each rests on fewer than`
          + ` ${stats.enoughRuns} runs, which is too few to compare`,
        onlyOne: (agent) => `only ${agent} reports a cost, so there is nothing to compare it against`,
      }, reportingCost, withCost),
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

  const reportingTime = stats.byAgent.filter((group) => group.medianSeconds !== undefined);
  const withTime = groups.filter((group) => group.medianSeconds !== undefined);
  if (withTime.length < 2) {
    gaps.push({
      kind: "fastest",
      // The same three states as cost. A duration is derived from the
      // entries' own timestamps rather than reported by an agent, so
      // "nothing recorded a duration" is rarer here — and saying it
      // when it is true is what tells a reader the log itself is
      // unusable, rather than merely thin.
      reason: gapReason({
        nothingReported: `no run has recorded a usable duration across ${plural(stats.runs, "recorded run")}`,
        tooFew: (reporting) => `${plural(reporting, "agent")} recorded a duration, but each rests on fewer than`
          + ` ${stats.enoughRuns} runs, which is too few to compare`,
        onlyOne: (agent) => `only ${agent} has enough recorded runs to time, so there is nothing to compare it against`,
      }, reportingTime, withTime),
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
      // Every paired run has an outcome, so "nothing reported it" here
      // means the log has no runs at all rather than that agents were
      // silent.
      reason: gapReason({
        nothingReported: "no run has been recorded in this workspace",
        tooFew: (reporting) => `${plural(reporting, "agent")} recorded runs, but each rests on fewer than`
          + ` ${stats.enoughRuns} runs, which is too few to compare`,
        onlyOne: (agent) => `only ${agent} has enough recorded runs, so there is nothing to compare it against`,
      }, stats.byAgent, groups),
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
