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

import type { AgentStatusStopRequest, AgentStatusWaiting } from "./agent-status.js";
import type { EnrolledPerson, RecordSignature } from "./signature-facts.js";
import type { ChangeReadinessReport } from "./change-readiness-facts.js";
import type { ChangeStanding, ChangeStandings } from "./change-standing-facts.js";
import { describeChangeState, type ChangeStateFacts } from "./change-state-word.js";
import type { LastRun, LastRunsReport } from "./last-runs-facts.js";
import {
  describeTaskInHand,
  describeWaiting,
  withSurveyedRuns,
  type SurveyedDirectory,
  type SurveyedRun,
  type SurveyedTask,
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
  /** The run is held elsewhere, and its verified record is signed by the
   * person this host's own key is enrolled as, so the card may offer to ask
   * it to stop through the signed channel (a-run-elsewhere-can-be-asked-to-stop). */
  stoppableByMe: boolean;
  /** How far the run's record shows whose it is. */
  signature: RecordSignature;
  /** The enrolled person, where the record is verified. */
  person?: EnrolledPerson;
  /** The stop the run has heard, where its record holds one. */
  stopRequested: AgentStatusStopRequest | null;
  /** When this host asked the run to stop, where it has, so the card can say
   * it is waiting for the run to read the request. */
  stopAskedAt?: string;
  /** Where the run was started, as its record says: the folder a card for a
   * run held elsewhere offers to copy, and never to open. */
  workingDirectory: string;
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
  /** Every row of the change's task list with its word, read from where
   * the card's facts are. Absent where there is no task list
   * (a-card-opens-to-its-tasks). */
  tasks?: TaskRow[];
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
  /** The roster label of this host's own machine key, where it is enrolled.
   * A card offers Stop on a run held elsewhere only when that run's verified
   * record is signed by this person (a-run-elsewhere-can-be-asked-to-stop). */
  myLabel?: string;
  /** When this host asked each run to stop, by instance id. */
  stopsAsked?: ReadonlyMap<string, string>;
  now: Date;
}

/** How long a card waits for a run to read a request before saying it has
 * not: two of the status writer's renewals, each five seconds
 * (`AGENT_STATUS_RENEW_INTERVAL_MS`, pinned by a test). Written out here
 * because this module is the browser's and the writer's is Node's. */
export const STOP_REQUEST_READ_WITHIN_MS = 10_000;

const THIS_CHECKOUT: ChangeCardWhere = { label: "this checkout", path: "", ownWorktree: false };

/** One card for each change of the report, in the report's order. */
export function describeChangeCards({ report, survey, lastRuns, standings, liveRunIds = [], myLabel, stopsAsked }: ChangeCardInputs): ChangeCard[] {
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
    const run = shownRun === undefined
      ? undefined
      : cardRun(shownRun, surveyed?.nextOpenTask, ownedHere, myLabel, stopsAsked?.get(shownRun.instanceId));

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
      standing: standingOf(name, standings, survey, where, progress, runs),
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
      ...(surveyed?.tasks !== undefined ? { tasks: describeTaskRows(surveyed.tasks, run?.task) } : {}),
      stateFacts,
    };
  });
}

/** What a task row on an open card says it is, from a closed set
 * (a-card-opens-to-its-tasks). */
export type TaskRowWord =
  | "done"
  | "in hand"
  | "probably next"
  | "open"
  | "only a person can close it"
  | `delegated to ${string}`;

export interface TaskRow extends SurveyedTask {
  word: TaskRowWord;
}

/** The rows an open card lists, in the task list's order, each with its
 * word. At most one row is `in hand` or `probably next`: the first open row
 * whose number is the card's task in hand, or its guess. A done row says
 * done even where a record still names it. */
export function describeTaskRows(tasks: readonly SurveyedTask[], inHand: ChangeCardTask | undefined): TaskRow[] {
  let named = false;
  return tasks.map((task) => {
    let word: TaskRowWord;
    if (task.done) word = "done";
    else if (!named && inHand !== undefined && task.number !== undefined && task.number === inHand.number) {
      named = true;
      word = inHand.source === "guess" ? "probably next" : "in hand";
    } else if (task.closedBy === "person") word = "only a person can close it";
    else if (task.closedBy === "named-agent" && task.agent !== undefined) word = `delegated to ${task.agent}`;
    else word = "open";
    return { ...task, word };
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

function cardRun(
  run: SurveyedRun,
  nextOpenTask: { number: string; text: string } | undefined,
  ownedHere: boolean,
  myLabel: string | undefined,
  stopAskedAt: string | undefined,
): ChangeCardRun {
  const task: ChangeCardTask | undefined = run.task !== undefined
    ? { number: run.task.number, text: run.task.text, source: run.task.source }
    // The guess: a record that names no task is probably on the first open
    // one a run can close.
    : nextOpenTask !== undefined ? { ...nextOpenTask, source: "guess" } : undefined;
  // Offered only for the person's own verified runs: ADR 0028 does not offer
  // stopping somebody else's agent in the interface. Decided here, never in
  // a view.
  const stoppableByMe = !ownedHere
    && run.signature === "verified"
    && myLabel !== undefined
    && myLabel.length > 0
    && run.person?.label === myLabel;
  return {
    instanceId: run.instanceId,
    runId: run.runId,
    ownedHere,
    stoppableByMe,
    signature: run.signature,
    ...(run.person !== undefined ? { person: run.person } : {}),
    stopRequested: run.stopRequested ?? null,
    ...(stopAskedAt !== undefined ? { stopAskedAt } : {}),
    workingDirectory: run.workingDirectory,
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
  survey: WorktreeSurvey | undefined,
  where: ChangeCardWhere,
  progress: ChangeCardProgress | undefined,
  runs: readonly SurveyedRun[],
): ChangeStanding {
  const read = standings?.standings.find((standing) => standing.changeName === changeName);
  if (read !== undefined) return withSurveyedRuns(read, survey);
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
    // A run held elsewhere and not the person's own says whose it is, as far
    // as its signature shows, since the card offers nothing to stop it
    // (a-run-elsewhere-can-be-asked-to-stop).
    if (!run.ownedHere && !run.stoppableByMe) {
      lines.push(run.signature === "verified" && run.person !== undefined ? `${run.person.label}'s run, verified` : "not verified");
    }
    // A request this host sent, until the run's record shows it heard one.
    // Never that the run refused: a refusal is the run's to say.
    if (run.stopAskedAt !== undefined && run.stopRequested === null) {
      const asked = Date.parse(run.stopAskedAt);
      const age = ageFrom(run.stopAskedAt, now);
      if (Number.isFinite(asked) && age !== undefined) {
        lines.push(now.getTime() - asked <= STOP_REQUEST_READ_WITHIN_MS
          ? `stop requested ${age}; waiting for the run to read it`
          : `stop requested ${age}; the run has not read the request`);
      }
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
