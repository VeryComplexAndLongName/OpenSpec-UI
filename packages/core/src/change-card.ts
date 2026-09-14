// One card per change, and the words on it — a-card-says-what-its-change-is-doing
// (ADR 0029).
//
// A card is derived here from the readings a host already takes: the
// readiness report, the survey of every working directory, and how each
// change's last run ended. The Pipeline view draws what this returns and
// computes none of it. Its state word comes from `describeChangeState`,
// the same function the Changes list and `ready` call, so a card never says
// one word where the list says another.
//
// Pure and free of Node built-ins: the browser bundle has it.

import type { AgentStatusWaiting } from "./agent-status.js";
import type { ChangeReadinessReport } from "./change-readiness-facts.js";
import type { ChangeStanding, ChangeStandings } from "./change-standing-facts.js";
import { describeChangeState, type ChangeStateFacts } from "./change-state-word.js";
import type { LastRun, LastRunsReport } from "./last-runs-facts.js";
import {
  describeTaskInHand,
  describeWaiting,
  type SurveyedDirectory,
  type SurveyedRun,
  type WorktreeSurvey,
} from "./worktree-survey-facts.js";

/** What a card says its change is doing, in precedence order. */
export type ChangeCardState = "waiting" | "running" | "failed" | "stopped" | "blocked" | "done" | "ready";

export interface ChangeCardTask {
  number: string;
  text: string;
  /** `agent`: the run's own marker. `command`: the task the run was given.
   * `guess`: the record names no task, and this is the first open one. */
  source: "agent" | "command" | "guess";
}

/** The live run a card shows. */
export interface ChangeCardRun {
  /** The run's record, so a list of runs can leave out the one this card
   * already shows. */
  instanceId: string;
  /** The run id a host answers or stops the run by, where its record
   * carries one. */
  runId: string | null;
  /** The host showing this card started the run and holds it, so the card
   * may offer to answer and stop it (a-change-is-run-from-its-card). */
  ownedHere: boolean;
  stage: string | null;
  activity: string;
  activityAt: string;
  waiting: AgentStatusWaiting | null;
  task?: ChangeCardTask;
}

export interface ChangeCardProgress {
  done: number;
  total: number;
  /** Open items only a person can close. */
  forPerson: number;
  /** Open items delegated to a named agent. */
  delegated: number;
}

export interface ChangeCardWhere {
  label: string;
  path: string;
  branch?: string;
  /** The facts were read from the change's own worktree. */
  ownWorktree: boolean;
}

export interface ChangeCard {
  changeName: string;
  state: ChangeCardState;
  run?: ChangeCardRun;
  progress?: ChangeCardProgress;
  lastRun?: LastRun;
  where: ChangeCardWhere;
  /** The state word and colour's inputs, kept so `describeChangeCard` asks
   * `describeChangeState` the same question the Changes list asks. */
  stateFacts: ChangeStateFacts;
}

export interface ChangeCardInputs {
  report: ChangeReadinessReport;
  survey?: WorktreeSurvey;
  lastRuns?: LastRunsReport;
  /** Where each change stands across the repository, where the host read
   * it. Without it a card's word is the one this checkout's facts give. */
  standings?: ChangeStandings;
  /** The run ids of the runs the host showing the cards started and holds
   * (its live-runs list). A card offers controls only for these. */
  liveRunIds?: readonly string[];
  now: Date;
}

const THIS_CHECKOUT: ChangeCardWhere = { label: "this checkout", path: "", ownWorktree: false };

/** One card for each change of the report, in the report's order. */
export function describeChangeCards({ report, survey, lastRuns, standings, liveRunIds = [] }: ChangeCardInputs): ChangeCard[] {
  const here = survey?.directories.find((directory) => directory.isThis);
  const held = new Set(liveRunIds);
  return report.changes.map((change) => {
    const name = change.changeName;
    // A change is one card, wherever it is worked (ADR 0029): where a
    // directory is the change's own worktree, that directory's copy is the
    // one being worked, and its facts are the card's.
    const own = survey?.directories.find((directory) => !directory.isThis && directory.belongsTo === name);
    const source: SurveyedDirectory | undefined = own ?? here;
    const surveyed = source?.readable ? source.changes.find((candidate) => candidate.changeName === name) : undefined;
    const runs = (source?.runs ?? []).filter((run) => run.changeName === name && !run.gone);

    const where: ChangeCardWhere = source === undefined
      ? THIS_CHECKOUT
      : { label: source.label, path: source.path, ...(source.branch ? { branch: source.branch } : {}), ownWorktree: own !== undefined };

    const progress: ChangeCardProgress | undefined = surveyed === undefined
      ? undefined
      : {
        done: surveyed.tasksDone,
        total: surveyed.tasksTotal,
        forPerson: surveyed.tasksForPerson ?? 0,
        delegated: surveyed.tasksDelegated ?? 0,
      };

    const waitingRun = runs.find((run) => run.waiting !== null);
    const shownRun = waitingRun ?? runs[0];
    const ownedHere = shownRun?.runId !== undefined && shownRun.runId !== null && held.has(shownRun.runId);
    const run = shownRun === undefined ? undefined : cardRun(shownRun, surveyed?.nextOpenTask, ownedHere);

    const lastRun = lastRuns?.byChange[name];
    // A failure older than the task list no longer decides the card: the
    // list has been worked on since.
    const endedUnfinished = lastRun !== undefined
      && lastRun.outcome !== "completed"
      && !olderThan(lastRun.endedAt, surveyed?.tasksModifiedAt);

    const readiness = change.run.state;
    let state: ChangeCardState;
    if (waitingRun !== undefined) state = "waiting";
    else if (shownRun !== undefined || readiness === "running") state = "running";
    else if (endedUnfinished) state = lastRun.outcome === "failed" ? "failed" : "stopped";
    else if (readiness === "blocked") state = "blocked";
    else if (progress !== undefined && progress.total > 0 && progress.done === progress.total) state = "done";
    else state = "ready";

    const stateFacts: ChangeStateFacts = {
      standing: standingOf(name, standings, where, progress, runs),
      // Where a run's own record is surveyed, the record says whether it
      // works or waits; a lease saying "running" would otherwise outrank a
      // record saying it waits.
      ...(readiness === "running" && runs.length > 0 ? {} : { readiness }),
      // "Waiting for you" only where this host can answer (ADR 0029).
      ...(waitingRun !== undefined && ownedHere ? { answerableHere: true } : {}),
      ...(endedUnfinished
        ? { lastRun: { outcome: lastRun.outcome === "failed" ? "failed" as const : "stopped" as const, ...(lastRun.stage !== undefined ? { stage: lastRun.stage } : {}) } }
        : {}),
    };

    return {
      changeName: name,
      state,
      ...(run !== undefined ? { run } : {}),
      ...(progress !== undefined ? { progress } : {}),
      ...(lastRun !== undefined ? { lastRun } : {}),
      where,
      stateFacts,
    };
  });
}

/** The runs the cards show, by instance id — what a directory's run lines
 * leave out, so no run is said twice. */
export function runsShownOnCards(cards: readonly ChangeCard[]): Set<string> {
  const shown = new Set<string>();
  for (const card of cards) if (card.run !== undefined) shown.add(card.run.instanceId);
  return shown;
}

function olderThan(endedAt: string, modifiedAt: string | undefined): boolean {
  if (modifiedAt === undefined) return false;
  const ended = Date.parse(endedAt);
  const modified = Date.parse(modifiedAt);
  return Number.isFinite(ended) && Number.isFinite(modified) && ended < modified;
}

function cardRun(run: SurveyedRun, nextOpenTask: { number: string; text: string } | undefined, ownedHere: boolean): ChangeCardRun {
  const task: ChangeCardTask | undefined = run.task !== undefined
    ? { number: run.task.number, text: run.task.text, source: run.task.source }
    // The guess: a record that names no task is probably on the first open
    // one a run can close.
    : nextOpenTask !== undefined ? { ...nextOpenTask, source: "guess" } : undefined;
  return {
    instanceId: run.instanceId,
    runId: run.runId,
    ownedHere,
    stage: run.stage,
    activity: run.activity,
    activityAt: run.activityAt,
    waiting: run.waiting,
    ...(task !== undefined ? { task } : {}),
  };
}

/** The standing the state word is asked about: the one the host read, or
 * this card's own copy alone. */
function standingOf(
  changeName: string,
  standings: ChangeStandings | undefined,
  where: ChangeCardWhere,
  progress: ChangeCardProgress | undefined,
  runs: readonly SurveyedRun[],
): ChangeStanding {
  const read = standings?.standings.find((standing) => standing.changeName === changeName);
  if (read !== undefined) return read;
  return {
    changeName,
    here: {
      label: where.label,
      path: where.path,
      ...(where.branch !== undefined ? { branch: where.branch } : {}),
      ...(progress !== undefined ? { counts: { done: progress.done, total: progress.total } } : {}),
      runs: runs.map((run) => ({ instanceId: run.instanceId, stage: run.stage, waiting: run.waiting !== null })),
    },
    elsewhere: [],
  };
}

/** An age in the words a card uses. */
function ago(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function ageFrom(at: string, now: Date): string | undefined {
  const stamp = Date.parse(at);
  return Number.isFinite(stamp) ? ago(now.getTime() - stamp) : undefined;
}

const ENDED_WORD: Record<LastRun["outcome"], string> = {
  completed: "completed",
  failed: "failed",
  cancelled: "stopped",
};

export interface DescribedChangeCard {
  /** The state word, from `describeChangeState`. */
  stateWords: string;
  /** What else the card says, in order, each only where there is something
   * to say. */
  lines: string[];
}

/** A card's state word and lines. */
export function describeChangeCard(card: ChangeCard, now: Date): DescribedChangeCard {
  const lines: string[] = [];
  const { run, progress, lastRun, where } = card;

  if (run?.task !== undefined) {
    lines.push(run.task.source === "guess"
      ? `probably task ${run.task.number}: ${run.task.text}`
      : describeTaskInHand({ number: run.task.number, text: run.task.text, source: run.task.source }));
  }

  if (run !== undefined) {
    if (run.waiting !== null) {
      // A run held elsewhere is answered where it was started, not here
      // (a-change-is-run-from-its-card).
      lines.push(`${describeWaiting(run.waiting)}, in ${where.label}${run.ownedHere ? "" : " — answered where it was started"}`);
    } else {
      const age = ageFrom(run.activityAt, now);
      lines.push(age !== undefined ? `${run.activity} — said ${age}` : run.activity);
    }
  }

  if (progress !== undefined && progress.total > 0) {
    let text = `${progress.done} of ${progress.total} tasks done`;
    if (progress.forPerson > 0) text += `; ${progress.forPerson} only a person can close`;
    if (progress.delegated > 0) text += `; ${progress.delegated} delegated`;
    lines.push(text);
  }

  if (lastRun !== undefined) {
    const at = lastRun.stage !== undefined ? ` at ${lastRun.stage}` : "";
    const age = ageFrom(lastRun.endedAt, now);
    let text = `last run ${ENDED_WORD[lastRun.outcome]}${at}${age !== undefined ? ` ${age}` : ""}`;
    if (lastRun.costUsd !== undefined) text += `, $${lastRun.costUsd.toFixed(2)}`;
    if (lastRun.outcome === "cancelled" && lastRun.reason !== undefined) text += ` — ${lastRun.reason}`;
    lines.push(text);
  }

  // This checkout is where the whole picture was read, and says so above
  // it; only a card read from elsewhere names where.
  if (where.ownWorktree) {
    lines.push(`in ${where.label}${where.branch !== undefined ? `, on branch ${where.branch}` : ""}`);
  }

  return { stateWords: describeChangeState(card.stateFacts).word, lines };
}
