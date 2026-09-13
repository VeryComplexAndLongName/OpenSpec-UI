// One word for a change, on every surface — ADR 0029's amendment of
// 2026-09-13.
//
// The only code that picks a change's state word. The Changes tree, the
// standalone Changes list, `openspec-ui-cli ready` and the Pipeline card all
// call `describeChangeState`, so a change never reads one way in one place
// and another way in the next. A leaf with type imports only, so the browser
// can have it. `change-state.ts` re-exports it for Node importers.

import type { ChangeStanding, StandingCopy, TaskCounts } from "./change-standing-facts.js";

/** The closed set of state words, in precedence order. */
export type ChangeStateKey =
  | "running"
  | "running-elsewhere"
  | "waiting"
  | "waiting-elsewhere"
  | "archived-on-main"
  | "merged"
  | "deleted-on-main"
  | "further-along"
  | "failed"
  | "stopped"
  | "done"
  | "blocked"
  | "ready";

/** The colour a surface paints a word in. The word is always present, so a
 * colour never carries the state alone. */
export type ChangeStateColour = "now" | "settled" | "ahead" | "failed" | "deleted" | "none";

export interface ChangeStateFacts {
  standing: ChangeStanding;
  /** What readiness says about this checkout's copy, where it was read. */
  readiness?: "running" | "blocked" | "ready";
  /** How the last run here ended, where it ended without finishing. Filled
   * in by a-card-says-what-its-change-is-doing; a fact not yet read takes no
   * part. */
  lastRun?: { outcome: "failed" | "stopped"; stage: string };
}

export interface ChangeStateLine {
  text: string;
  /** Where the fact came from. */
  source: string;
}

export interface DescribedChangeState {
  key: ChangeStateKey;
  word: string;
  colour: ChangeStateColour;
  /** A one-character badge, where a surface has room for no more. Absent for
   * a change that is simply ready. */
  badge?: string;
  /** Whatever else applies, each naming its source. */
  lines: ChangeStateLine[];
}

interface Candidate {
  key: ChangeStateKey;
  word: string;
  source: string;
}

const COLOUR: Record<ChangeStateKey, ChangeStateColour> = {
  running: "now",
  "running-elsewhere": "now",
  waiting: "now",
  "waiting-elsewhere": "now",
  "archived-on-main": "settled",
  merged: "settled",
  "deleted-on-main": "deleted",
  "further-along": "ahead",
  failed: "failed",
  stopped: "failed",
  done: "none",
  blocked: "none",
  ready: "none",
};

const BADGE: Partial<Record<ChangeStateKey, string>> = {
  running: "R",
  "running-elsewhere": "R",
  waiting: "W",
  "waiting-elsewhere": "W",
  "archived-on-main": "A",
  merged: "M",
  "deleted-on-main": "D",
  "further-along": "F",
  failed: "X",
  stopped: "S",
  done: "✓",
  blocked: "B",
};

function counted(counts: TaskCounts): string {
  return `${counts.done} of ${counts.total} done`;
}

/** The copy furthest along of those that are ahead of this checkout's. */
function furthestAhead(standing: ChangeStanding): { where: string; counts: TaskCounts } | undefined {
  const here = standing.here?.counts;
  if (here === undefined) return undefined;
  const others: Array<{ where: string; counts: TaskCounts }> = [];
  for (const copy of standing.elsewhere) {
    if (copy.counts !== undefined) others.push({ where: `in ${copy.label}`, counts: copy.counts });
  }
  if (standing.branch?.counts !== undefined) others.push({ where: `on branch ${standing.branch.name}`, counts: standing.branch.counts });
  if (standing.main?.kind === "active" && standing.main.counts !== undefined) {
    others.push({ where: "on main", counts: standing.main.counts });
  }
  const ahead = others.filter((other) => other.counts.done > here.done);
  ahead.sort((left, right) => right.counts.done - left.counts.done);
  return ahead[0];
}

function liveRuns(copy: StandingCopy | undefined): { working: boolean; waiting: boolean } {
  const runs = copy?.runs ?? [];
  return { working: runs.some((run) => !run.waiting), waiting: runs.some((run) => run.waiting) };
}

/** Every word that applies, in precedence order. */
function candidates(facts: ChangeStateFacts): Candidate[] {
  const { standing } = facts;
  const found: Candidate[] = [];

  const here = liveRuns(standing.here);
  if (here.working || facts.readiness === "running") {
    found.push({ key: "running", word: "Running", source: here.working ? "a run's record here" : "this checkout's lease" });
  }
  for (const copy of standing.elsewhere) {
    if (liveRuns(copy).working) found.push({ key: "running-elsewhere", word: `Running in ${copy.label}`, source: `a run's record in ${copy.label}` });
  }
  if (here.waiting) found.push({ key: "waiting", word: "Waiting for you", source: "a run's record here" });
  for (const copy of standing.elsewhere) {
    if (liveRuns(copy).waiting) found.push({ key: "waiting-elsewhere", word: `Waiting in ${copy.label}`, source: `a run's record in ${copy.label}` });
  }

  if (standing.main?.kind === "archived") {
    found.push({ key: "archived-on-main", word: "Archived on main", source: `main, as ${standing.main.archiveName}` });
  }
  if (standing.pullRequest?.state === "MERGED") {
    found.push({ key: "merged", word: `Merged in #${standing.pullRequest.number}`, source: "the change's pull request" });
  }
  if (standing.main?.kind === "deleted") {
    found.push({ key: "deleted-on-main", word: "Deleted on main", source: "main, against the merge base" });
  }

  const ahead = furthestAhead(standing);
  if (ahead !== undefined) {
    found.push({ key: "further-along", word: `Further along ${ahead.where}`, source: `the copy ${ahead.where}` });
  }

  if (facts.lastRun !== undefined) {
    found.push(facts.lastRun.outcome === "failed"
      ? { key: "failed", word: `Failed at ${facts.lastRun.stage}`, source: "the last run here" }
      : { key: "stopped", word: `Stopped at ${facts.lastRun.stage}`, source: "the last run here" });
  }

  const counts = standing.here?.counts;
  if (counts !== undefined && counts.total > 0 && counts.done === counts.total) {
    found.push({ key: "done", word: "Done", source: "this checkout's tasks" });
  } else if (facts.readiness === "blocked") {
    found.push({ key: "blocked", word: "Blocked", source: "this checkout's declared order" });
  } else {
    found.push({ key: "ready", word: "Ready", source: "this checkout" });
  }
  return found;
}

/** Whether any source other than this checkout has the change. */
function onlyHere(standing: ChangeStanding): boolean {
  return standing.elsewhere.length === 0
    && (standing.main === undefined || standing.main.kind === "absent")
    && standing.branch === undefined
    && standing.pullRequest === undefined;
}

/** A change's state word, its colour, and the lines beneath it. */
export function describeChangeState(facts: ChangeStateFacts): DescribedChangeState {
  const [chosen, ...rest] = candidates(facts) as [Candidate, ...Candidate[]];
  const lines: ChangeStateLine[] = rest.map((candidate) => ({ text: candidate.word, source: candidate.source }));

  const { standing } = facts;
  const ahead = furthestAhead(standing);
  if (ahead !== undefined && standing.here?.counts !== undefined) {
    const here = standing.here.counts;
    lines.push({ text: `${counted(ahead.counts)} ${ahead.where}, ${here.done} of ${here.total} here`, source: `the copy ${ahead.where}` });
  }
  if (standing.pullRequest !== undefined && standing.pullRequest.state !== "MERGED") {
    lines.push({ text: `Pull request #${standing.pullRequest.number} is ${standing.pullRequest.state.toLowerCase()}`, source: "the change's pull request" });
  }
  if (standing.here === undefined) lines.push({ text: "Not in this checkout", source: "this checkout" });
  else if (onlyHere(standing)) lines.push({ text: "Only here", source: "every source read" });

  return {
    key: chosen.key,
    word: chosen.word,
    colour: COLOUR[chosen.key],
    ...(BADGE[chosen.key] !== undefined ? { badge: BADGE[chosen.key] } : {}),
    lines,
  };
}
