// Where a change is, and how long it spent in each stage (ADR 0037
// decisions 5 and 6, a-change-knows-its-stage).
//
// A leaf with no Node imports, so the browser can have it: the facts are
// read in `change-stages.ts`.
//
// A stage is derived, never declared. Each dated fact proves a stage: a
// proposal committed, a task list written, a task closed or a run made, a
// pull request opened or pushed to while open, a merge, the archive. A fact
// moves a change forward and never back; only a `sent-back` event of its
// history moves it back, and after one, only facts newer than it move it on.
// A change can visit a stage many times, and each visit is kept.

import { CHANGE_STAGES, describeStage, type ChangeRoles, type ChangeStage } from "./change-history-facts.js";

export type StageFactSource = "git-commit" | "git-blame" | "audit-log" | "forge" | "history";

/** One dated fact, and the stage it proves. */
export interface StageFact {
  stage: ChangeStage;
  /** When, as an ISO date-time. */
  at: string;
  source: StageFactSource;
  /** What the fact is, in words: "proposal.md committed", "#12 opened". */
  what: string;
  /** Set on a `sent-back` event: it moves the change back to `stage`. */
  back?: true;
}

/** One stay of a change in one stage. */
export interface StageVisit {
  stage: ChangeStage;
  from: string;
  /** When it left, absent for the stage it is in now. */
  to?: string;
  /** The fact that brought it here. */
  enteredBy: StageFact;
}

/** How long a change has spent in one stage, over every visit. */
export interface StageTotal {
  stage: ChangeStage;
  visits: number;
  ms: number;
}

/** What a surface needs to show a change on the board: where it is, since
 * when, who holds it, and how long it has spent in each stage. The visits
 * themselves stay where they were read - a board draws none of them. */
export interface ChangeStageSummary {
  changeName: string;
  stage: ChangeStage;
  since?: string;
  roles: ChangeRoles;
  totals: StageTotal[];
}

/** The readings with every change the default branch already carries
 * archived moved to Archived, with no "since" of its own.
 *
 * A change's stage is read from the directory it is worked in, and a
 * checkout behind the default branch still holds a change as it was before
 * its archive: the board stood such changes In progress after they were
 * archived on main (reported by the owner on 2026-09-26). The default branch
 * is where the work ends, so its archive wins over any copy
 * (a-landed-change-leaves-the-board). */
export function settleOnDefaultBranch(
  summaries: readonly ChangeStageSummary[],
  archivedOnDefault: ReadonlySet<string>,
): ChangeStageSummary[] {
  return summaries.map((summary) => {
    if (!archivedOnDefault.has(summary.changeName) || summary.stage === "archived") return summary;
    const { changeName, roles, totals } = summary;
    return { changeName, stage: "archived", roles, totals };
  });
}

/** The stage of each change, by name, as a layout wants it. */
export function stagesByName(summaries: readonly ChangeStageSummary[]): Map<string, ChangeStage> {
  return new Map(summaries.map((one) => [one.changeName, one.stage]));
}

/** Where a change is and who holds it, in the words every surface uses:
 * "In review for 4h, ada owns it, bob implements it".
 *
 * A change nobody holds says only where it is. A card has one line for
 * this, and "nobody owns it, nobody implements it" filled it with the
 * absence of two facts (seen in the board's first capture). */
export function describeStageLine(summary: ChangeStageSummary, now: Date): string {
  const since = summary.since === undefined ? "" : ` for ${describeDuration(now.getTime() - Date.parse(summary.since))}`;
  const held = [
    ...(summary.roles.owner !== undefined ? [`${summary.roles.owner} owns it`] : []),
    ...(summary.roles.implementer !== undefined ? [`${summary.roles.implementer} implements it`] : []),
  ];
  return [`${describeStage(summary.stage)}${since}`, ...held].join(", ");
}

function rankOf(stage: ChangeStage): number {
  return CHANGE_STAGES.indexOf(stage);
}

/** The facts in the order they happened. At one instant a fact comes
 * before a `sent-back`: the step back is taken after what it answers. */
function ordered(facts: readonly StageFact[]): StageFact[] {
  return facts
    .filter((fact) => !Number.isNaN(Date.parse(fact.at)))
    .sort((left, right) => {
      const byTime = Date.parse(left.at) - Date.parse(right.at);
      if (byTime !== 0) return byTime;
      return (left.back ? 1 : 0) - (right.back ? 1 : 0);
    });
}

/** Plays the facts forward into visits. */
export function playStages(facts: readonly StageFact[]): StageVisit[] {
  const visits: StageVisit[] = [];
  for (const fact of ordered(facts)) {
    const current = visits.at(-1);
    const moves = fact.back === true
      ? current === undefined || current.stage !== fact.stage
      : current === undefined || rankOf(fact.stage) > rankOf(current.stage);
    if (!moves) continue;
    if (current !== undefined) current.to = fact.at;
    visits.push({ stage: fact.stage, from: fact.at, enteredBy: fact });
  }
  return visits;
}

/** The time in each stage, over every visit, in the order of the stages.
 * The stage a change is in now counts up to `now`. */
export function totalsOf(visits: readonly StageVisit[], now: Date): StageTotal[] {
  const totals = new Map<ChangeStage, StageTotal>();
  for (const visit of visits) {
    const end = visit.to === undefined ? now.getTime() : Date.parse(visit.to);
    const ms = Math.max(0, end - Date.parse(visit.from));
    const total = totals.get(visit.stage) ?? { stage: visit.stage, visits: 0, ms: 0 };
    total.visits += 1;
    total.ms += ms;
    totals.set(visit.stage, total);
  }
  return CHANGE_STAGES.filter((stage) => totals.has(stage)).map((stage) => totals.get(stage) as StageTotal);
}

/** The stage a change's own files say, for a change nothing is dated for
 * yet: no proposal, a proposal only, or a task list written. */
export function stageFromFiles(tasks: { total: number; done: number }, proposal = true): ChangeStage {
  if (!proposal) return "drafted";
  if (tasks.done > 0) return "in-progress";
  return tasks.total > 0 ? "planned" : "proposed";
}

/** A duration, short: `3d 4h`, `2h 5m`, `12m`, `under a minute`. */
export function describeDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "under a minute";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  return `${rest}m`;
}

/** One visit, in the words every surface uses. */
export function describeVisit(visit: StageVisit, now: Date): string {
  const end = visit.to === undefined ? now.getTime() : Date.parse(visit.to);
  const how = visit.enteredBy.back === true ? `sent back: ${visit.enteredBy.what}` : visit.enteredBy.what;
  const until = visit.to === undefined ? "now" : visit.to;
  return `${describeStage(visit.stage)}, ${visit.from} to ${until}, ${describeDuration(end - Date.parse(visit.from))} (${how})`;
}
