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
  // Finished and did not land: the two alarms
  // (a-change-lands-with-nothing-open).
  | "finished-never-pushed"
  | "finished-rejected"
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
  /** The changes still blocking this one, where readiness was read. A
   * listing that says only "Blocked" sends the reader to the graph to
   * learn what by, which is the trip DW made on 2026-09-18
   * (a-blocked-change-says-so-where-it-is-listed). */
  blockers?: readonly string[];
  /** How the last run here ended, where it ended without finishing. Filled
   * in by a-card-says-what-its-change-is-doing; a fact not yet read takes no
   * part. */
  lastRun?: { outcome: "failed" | "stopped"; stage?: string };
  /** Whether the run waiting here can be answered from the surface asking:
   * the host showing it started the run (a-change-is-run-from-its-card).
   * ADR 0029 says "Waiting for you" only then; a run waiting here that
   * something else holds is "Waiting in" this checkout. A surface that holds
   * no runs leaves this out. */
  answerableHere?: boolean;
  /** Whether pull requests could be read at all. Without it the two
   * alarms below stay silent: an absent pull request and a source that
   * did not answer look the same from here, and only one of them is
   * worth an alarm (a-change-lands-with-nothing-open). */
  pullRequestsRead?: boolean;
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
  // An alarm is drawn as a failure: it is the colour a reader stops at.
  "finished-never-pushed": "failed",
  "finished-rejected": "failed",
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

/** Whether every item of the change is closed, as the copy that has the
 * most to say about it counts them. A change with no task list counted
 * says nothing: zero of zero is not "finished". */
function everyItemClosed(standing: ChangeStanding): boolean {
  const counts = standing.here?.counts ?? standing.elsewhere.find((copy) => copy.counts !== undefined)?.counts;
  return counts !== undefined && counts.total > 0 && counts.done >= counts.total;
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
  if (here.waiting) {
    found.push(facts.answerableHere === true
      ? { key: "waiting", word: "Waiting for you", source: "a run's record here, held by this host" }
      : { key: "waiting", word: `Waiting in ${standing.here?.label ?? "this checkout"}`, source: "a run's record here" });
  }
  for (const copy of standing.elsewhere) {
    if (liveRuns(copy).waiting) found.push({ key: "waiting-elsewhere", word: `Waiting in ${copy.label}`, source: `a run's record in ${copy.label}` });
  }

  // Two alarms, before the ordinary words: work that is finished and did
   // not land (a-change-lands-with-nothing-open). Loud because they are
   // rare, and silent where pull requests could not be read.
  if (facts.pullRequestsRead === true && everyItemClosed(standing) && standing.main?.kind !== "archived") {
    if (standing.pullRequest === undefined) {
      found.push({
        key: "finished-never-pushed",
        word: "Finished, never pushed",
        source: "its task list, and no pull request",
      });
    } else if (standing.pullRequest.state === "CLOSED") {
      found.push({
        key: "finished-rejected",
        word: `Finished, and #${standing.pullRequest.number} was closed`,
        source: "its task list, and the change's pull request",
      });
    }
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
    // A run whose log names no stage is plainly Failed or Stopped, rather
    // than "at" something invented.
    const at = facts.lastRun.stage !== undefined ? ` at ${facts.lastRun.stage}` : "";
    found.push(facts.lastRun.outcome === "failed"
      ? { key: "failed", word: `Failed${at}`, source: "the last run here" }
      : { key: "stopped", word: `Stopped${at}`, source: "the last run here" });
  }

  const counts = standing.here?.counts;
  const done = counts !== undefined && counts.total > 0 && counts.done === counts.total;
  if (done) found.push({ key: "done", word: "Done", source: "this checkout's tasks" });
  // Beside Done rather than instead of it: a change whose tasks are all
  // ticked and whose blocker is still active is both, and a listing that
  // drops either fact sends its reader somewhere else to learn it.
  if (facts.readiness === "blocked") {
    found.push({ key: "blocked", word: blockedWord(facts.blockers ?? []), source: "this checkout's declared order" });
  } else if (!done) {
    found.push({ key: "ready", word: "Ready", source: "this checkout" });
  }
  return found;
}

/** "Blocked by <name>", and "and N more" past the first: what blocks a
 * change is the question a reader asks next, and the graph is where they
 * had to go for it. */
function blockedWord(blockers: readonly string[]): string {
  const [first, ...rest] = blockers;
  if (first === undefined) return "Blocked";
  return rest.length === 0 ? `Blocked by ${first}` : `Blocked by ${first} and ${rest.length} more`;
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
