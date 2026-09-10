// What runs have cost in this workspace, read back from the audit log.
//
// `change-cost-report.ts` answers the same question for one change. This
// answers it for the workspace, because per change there is nothing to
// aggregate: measured 2026-09-09, 13 of the 22 changes carrying any
// record have exactly one run.
//
// Pure over entries, like every other analysis in core: the caller
// supplies both the entries and which changes exist. This module reads no
// files.

import type { AuditEntry, AuditOutcome } from "./security.js";
import type { HarnessEffort } from "./harness-step-agent.js";

/** How many paired runs a group needs before its figures are offered as
 * an answer rather than as an accumulation.
 *
 * Chosen, not measured — there is no distribution of thresholds to draw
 * one from. Five is small enough to be reachable and large enough that a
 * median is not one run wearing a hat. Stated here and reported with the
 * groups, so a reader can disagree with the number rather than guess it. */
export const ENOUGH_RUNS = 5;

const TERMINAL: ReadonlySet<AuditOutcome> = new Set<AuditOutcome>(["completed", "failed", "cancelled", "blocked"]);

export interface RunGroupFigures {
  /** Paired runs in this group. */
  runs: number;
  completed: number;
  /** Runs that reported a cost — separate from `runs`, because an agent
   * that reports nothing has runs and no costs, and it is the gap between
   * these two numbers that says so. */
  costSamples: number;
  medianCostUsd?: number;
  p90CostUsd?: number;
  medianSeconds?: number;
  p90Seconds?: number;
  /** `false` when this group rests on fewer than `ENOUGH_RUNS`. Reported
   * rather than omitted: leaving a thin group out makes "too little is
   * known here" indistinguishable from "this has never run". */
  enough: boolean;
}

export interface AgentRunGroup extends RunGroupFigures {
  agent: string;
  /** Absent for the per-agent groups, and for runs recorded before the
   * effort field existed — which on 2026-09-09 was 39 of this
   * repository's 40 paired runs. */
  effort?: HarnessEffort;
}

export interface WorkspaceRunStats {
  /** Every entry read, before any exclusion — so a caller can say how
   * much was set aside and why. */
  entriesRead: number;
  /** Entries excluded because their change no longer exists. */
  entriesFromDeletedChanges: number;
  /** Paired runs from what remained. */
  runs: number;
  /** How many of those recorded which effort they ran at. The per-effort
   * groups can say nothing until this grows. */
  runsWithEffort: number;
  byAgent: AgentRunGroup[];
  byAgentAndEffort: AgentRunGroup[];
  /** Repeated here so a caller showing the groups does not have to import
   * the constant to explain them. */
  enoughRuns: number;
}

/** Which changes the workspace still has, by directory name — both the
 * active ones and the archived ones, the archived without their date
 * prefix. */
export interface KnownChanges {
  active: readonly string[];
  archived: readonly string[];
}

function changeNameOf(changeDir: string): string {
  const normalized = changeDir.replace(/\\/gu, "/").replace(/\/+$/u, "");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

/** Whether an entry belongs to a change the workspace still has.
 *
 * Exported because more than one analysis needs the same rule, and two
 * copies of "which runs count" would drift into two answers about the
 * same log. A change that is neither active nor archived was deleted,
 * and a deleted change is an experiment rather than part of the record.
 * An entry with no change at all is not counted either — there is
 * nothing to attribute it to. */
export function belongsToKnownChange(entry: { changeDir?: string }, known: KnownChanges): boolean {
  if (entry.changeDir === undefined) return false;
  return known.active.includes(changeNameOf(entry.changeDir))
    || known.archived.includes(changeNameOf(entry.changeDir));
}

function quantile(sorted: readonly number[], fraction: number): number | undefined {
  if (sorted.length === 0) return undefined;
  // Nearest-rank, which for these sample sizes is the honest choice:
  // interpolating between two observations invents a value that was never
  // measured, and with 15 samples the difference is a rounding artefact
  // presented as precision.
  const rank = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return sorted[Math.max(0, rank)];
}

function figuresFrom(costs: number[], seconds: number[], runs: number, completed: number): RunGroupFigures {
  const sortedCosts = [...costs].sort((left, right) => left - right);
  const sortedSeconds = [...seconds].sort((left, right) => left - right);
  return {
    runs,
    completed,
    costSamples: costs.length,
    ...(sortedCosts.length > 0 ? { medianCostUsd: quantile(sortedCosts, 0.5), p90CostUsd: quantile(sortedCosts, 0.9) } : {}),
    ...(sortedSeconds.length > 0
      ? { medianSeconds: quantile(sortedSeconds, 0.5), p90Seconds: quantile(sortedSeconds, 0.9) }
      : {}),
    enough: runs >= ENOUGH_RUNS,
  };
}

interface Bucket {
  agent: string;
  effort?: HarnessEffort;
  runs: number;
  completed: number;
  costs: number[];
  seconds: number[];
}

function bucketFor(map: Map<string, Bucket>, key: string, agent: string, effort?: HarnessEffort): Bucket {
  const existing = map.get(key);
  if (existing) return existing;
  const created: Bucket = { agent, ...(effort !== undefined ? { effort } : {}), runs: 0, completed: 0, costs: [], seconds: [] };
  map.set(key, created);
  return created;
}

function toGroups(map: Map<string, Bucket>): AgentRunGroup[] {
  return [...map.values()]
    .map((bucket) => ({
      agent: bucket.agent,
      ...(bucket.effort !== undefined ? { effort: bucket.effort } : {}),
      ...figuresFrom(bucket.costs, bucket.seconds, bucket.runs, bucket.completed),
    }))
    .sort((left, right) => right.runs - left.runs || left.agent.localeCompare(right.agent));
}

/** Aggregates the workspace's recorded runs.
 *
 * Runs against a change that is neither active nor archived are excluded.
 * Such a change was deleted, and a deleted change is an experiment rather
 * than part of the record — counting one makes this project's own testing
 * look like its behaviour, which on 2026-09-09 it would have: three
 * disposable smoke changes accounted for 24 of 108 entries, and their
 * stages were cut deliberately to test a ceiling. */
export function buildWorkspaceRunStats(
  entries: readonly AuditEntry[],
  known: KnownChanges,
): WorkspaceRunStats {
  const kept: AuditEntry[] = [];
  let fromDeleted = 0;
  for (const entry of entries) {
    if (entry.changeDir === undefined) continue;
    if (belongsToKnownChange(entry, known)) kept.push(entry);
    else fromDeleted += 1;
  }

  const claimed = new Set<number>();
  const byAgent = new Map<string, Bucket>();
  const byAgentAndEffort = new Map<string, Bucket>();
  let runs = 0;
  let runsWithEffort = 0;

  kept.forEach((entry, index) => {
    if (entry.outcome !== "started") return;
    // Paired by order, not by key alone — the same rule
    // `buildChangeCostReport` uses, because a chain that returned from
    // `verify` to `apply` has two `started` and two terminal entries
    // sharing a `runId` and a `stage`.
    let terminal: AuditEntry | undefined;
    for (let next = index + 1; next < kept.length; next += 1) {
      const candidate = kept[next] as AuditEntry;
      if (claimed.has(next) || !TERMINAL.has(candidate.outcome)) continue;
      if (candidate.runId !== entry.runId || candidate.stage !== entry.stage) continue;
      claimed.add(next);
      terminal = candidate;
      break;
    }
    if (!terminal) return;

    runs += 1;
    const effort = entry.effort ?? terminal.effort;
    if (effort !== undefined) runsWithEffort += 1;

    const cost = terminal.usage?.costUsd;
    const start = Date.parse(entry.timestamp);
    const end = Date.parse(terminal.timestamp);
    const seconds = Number.isNaN(start) || Number.isNaN(end) || end < start ? undefined : (end - start) / 1000;

    for (const [map, key, groupEffort] of [
      [byAgent, entry.agent, undefined],
      ...(effort !== undefined ? [[byAgentAndEffort, `${entry.agent}\u0000${effort}`, effort] as const] : []),
    ] as Array<[Map<string, Bucket>, string, HarnessEffort | undefined]>) {
      const bucket = bucketFor(map, key, entry.agent, groupEffort);
      bucket.runs += 1;
      if (terminal.outcome === "completed") bucket.completed += 1;
      if (cost !== undefined) bucket.costs.push(cost);
      if (seconds !== undefined) bucket.seconds.push(seconds);
    }
  });

  return {
    entriesRead: entries.length,
    entriesFromDeletedChanges: fromDeleted,
    runs,
    runsWithEffort,
    byAgent: toGroups(byAgent),
    byAgentAndEffort: toGroups(byAgentAndEffort),
    enoughRuns: ENOUGH_RUNS,
  };
}
