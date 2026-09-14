// What every working directory of a repository holds, and what its runs
// say — the survey's shape, and the words it is described in.
//
// A leaf so the browser can have it: `worktree-survey.ts` reads the
// filesystem and lists git worktrees, and the shell needs only the shape
// and the wording. Type imports only, the move `change-readiness-facts`
// made for the same reason. See ADR 0026 and
// openspec/changes/what-the-others-are-doing.

import type { AgentStatusStopRequest, AgentStatusWaiting } from "./agent-status.js";
// A leaf with no imports of its own, so the browser can have its wording.
import { describeSignature, type EnrolledPerson, type RecordSignature } from "./signature-facts.js";
import type { TaskInHand } from "./task-marker.js";
import type { WorkspaceLeaseConflict } from "./workspace-lease.js";

/** One item of a change's task list, as an open card lists it
 * (a-card-opens-to-its-tasks). */
export interface SurveyedTask {
  /** The number the item leads with, where it has one. */
  number?: string;
  /** The item's text, without its number. */
  text: string;
  /** The `## ` heading it is listed under, without the heading's number. */
  section?: string;
  done: boolean;
  /** Who may close it: the run's agent, only a person, or the named agent
   * it is delegated to. */
  closedBy: "agent" | "person" | "named-agent";
  /** The agent a `named-agent` item is delegated to. */
  agent?: string;
}

/** One change in one working directory's own queue.
 *
 * A change is the pair (directory, name), never the name alone: two
 * directories can hold a change of one name at different content, and
 * anything routed by name would reach the wrong one (ADR 0026). */
export interface SurveyedChange {
  changeName: string;
  tasksDone: number;
  tasksTotal: number;
  /** Why the counts are zero where they are because `tasks.md` could not
   * be read, rather than because it has no tasks. */
  tasksUnreadable?: string;
  /** The blockers this change declares that are still active in the same
   * directory — the relation that directory's own picture draws. A blocker
   * in another directory is not one: no order is declared between them. */
  blockers: string[];
  /** The paths of the other working directories that hold a change of
   * this name too. Reported, never resolved: it comes from ordinary
   * branching, and becomes a collision only when a copy is edited. */
  alsoIn: string[];
  /** Open items only a person can close. Absent where the change has no
   * task list (a-card-says-what-its-change-is-doing). */
  tasksForPerson?: number;
  /** Open items delegated to a named agent. Absent where there is no task
   * list. */
  tasksDelegated?: number;
  /** The first open item that is neither Human-only nor delegated, with its
   * number and its text without the number: what a run that names no task
   * is probably on. */
  nextOpenTask?: { number: string; text: string };
  /** When the task list was last modified, as an ISO timestamp. A failure
   * older than this no longer decides a card's state. */
  tasksModifiedAt?: string;
  /** Every item of the task list, in its order. Absent where there is no
   * task list, or it could not be read. */
  tasks?: SurveyedTask[];
}

/** What one run says it is doing, as its own status record says it.
 *
 * No verdict: a long turn and a hang produce the same silence, and
 * telling them apart is a person's judgement. */
export interface SurveyedRun {
  instanceId: string;
  changeName: string | null;
  stage: string | null;
  activity: string;
  /** Milliseconds since the activity last changed, measured when read. */
  activitySinceMs: number;
  /** Milliseconds since the record was last renewed, measured when read. */
  heartbeatAgeMs: number;
  /** When the activity last changed, as the record says. */
  activityAt: string;
  /** When the record was last renewed, as the record says. A picture on
   * screen for a minute counts its ages from these, not from the intervals
   * it was read with. */
  heartbeatAt: string;
  /** The heartbeat is past the staleness window: the writer is gone. */
  gone: boolean;
  workingDirectory: string;
  /** The run id a host uses to cancel or answer the run, where the record
   * carries one. */
  runId: string | null;
  /** What the run is waiting on, where it is waiting rather than working. */
  waiting: AgentStatusWaiting | null;
  /** The task the run is on, paired with its change's own task list.
   * Absent where the record names none, names a number the list does not
   * have, or the survey did not read the run's change. */
  task?: TaskInHand;
  /** How far the record's signature shows whose the run is. A run whose
   * record does not check out carries nothing else from it. */
  signature: RecordSignature;
  /** The enrolled person, where the record is verified. */
  person?: EnrolledPerson;
  /** The stop the run has heard, as its record holds it: `null` or absent
   * until it has read one. A card that asked says it is waiting for the run
   * until this appears (a-run-elsewhere-can-be-asked-to-stop). */
  stopRequested?: AgentStatusStopRequest | null;
}

interface SurveyedDirectoryBase {
  /** As git reports it. */
  path: string;
  /** Self-declared in the directory, or the directory's own name.
   * Attribution, never authentication — and a label, never an owner. */
  label: string;
  labelDeclared: boolean;
  isMain: boolean;
  /** The directory this survey was taken from. */
  isThis: boolean;
  /** Absent for a detached head. */
  branch?: string;
  head?: string;
  /** The change this directory is the worktree of (ADR 0022), while that
   * change is active in the main working directory. That change is one card
   * above, read from here, and is not drawn a second time among this
   * directory's changes (ADR 0029). */
  belongsTo?: string;
  /** What the runs reporting from this directory say. Empty means no run
   * this product started reports here — never that nobody is in it: a
   * person editing, or an agent started some other way, writes no record. */
  runs: SurveyedRun[];
}

export type SurveyedDirectory =
  | (SurveyedDirectoryBase & {
    readable: true;
    changes: SurveyedChange[];
    /** Absent means no mutating run holds the directory right now, which
     * is not the same as nobody working in it. */
    holder?: WorkspaceLeaseConflict;
    /** The holder's recorded git author differs from this checkout's own
     * configured identity — how a second person, not merely a second
     * directory, becomes visible. */
    authorDiffers: boolean;
  })
  | (SurveyedDirectoryBase & { readable: false; reason: string });

export interface WorktreeSurvey {
  directories: SurveyedDirectory[];
  /** Status records naming a path that is no longer a working directory
   * of this repository. Reported rather than dropped, and never attached
   * to a guess. */
  runsElsewhere: SurveyedRun[];
  /** Why the status records could not be read, where they could not. The
   * rest of the survey still stands. */
  runsUnreadable?: string;
  /** This checkout's configured git identity, where it has one. */
  thisAuthor?: string;
}

function ago(ms: number): string {
  return `${Math.max(0, Math.round(ms / 1000))}s ago`;
}

/** An age to state: counted from the record's own timestamp when a clock
 * is given, so a picture that stays on screen keeps counting; otherwise
 * the interval measured when the record was read. A timestamp that does
 * not parse falls back to that interval rather than to nonsense. */
function ageOf(at: string, measuredMs: number, now: Date | undefined): number {
  if (now === undefined) return measuredMs;
  const stamp = Date.parse(at);
  return Number.isFinite(stamp) ? now.getTime() - stamp : measuredMs;
}

/** The task a run is on, in the words every surface uses. Says whose
 * account it is: the agent's own marker, or the task the run was given.
 * Neither is checked against what the agent actually does. */
export function describeTaskInHand(task: TaskInHand): string {
  const whose = task.source === "agent" ? "by its own account" : "the task it was given";
  return `on task ${task.number}: ${task.text}, ${whose}`;
}

/** What a waiting run is waiting on. */
export function describeWaiting(waiting: AgentStatusWaiting): string {
  return waiting.kind === "checkpoint"
    ? `waiting to continue to ${waiting.nextStage}`
    : `waiting for a permission: ${waiting.description}`;
}

/** One run in the words every surface uses. */
export function describeRun(run: SurveyedRun, now?: Date): string {
  // Nothing a record that does not check out says is shown: not its change,
  // its activity or its age (a-run-is-signed-by-its-person).
  if (run.signature === "does-not-check-out") return `${run.instanceId}: ${describeSignature(run.signature)}`;
  const signed = `; ${describeSignature(run.signature, run.person)}`;
  // A waiting run says what it waits on in place of the stage it is in.
  const stage = run.stage && run.waiting === null ? `(${run.stage})` : undefined;
  const where = [run.changeName ?? undefined, stage]
    .filter((part): part is string => part !== undefined)
    .join(" ");
  const prefix = where.length > 0 ? `${where}: ` : "";
  const task = run.task ? `; ${describeTaskInHand(run.task)}` : "";
  if (run.gone) {
    return `${prefix}gone — last heard from ${ago(ageOf(run.heartbeatAt, run.heartbeatAgeMs, now))}, last said "${run.activity}"${task}${signed}`;
  }
  const said = run.waiting ? describeWaiting(run.waiting) : run.activity;
  return `${prefix}${said} — said ${ago(ageOf(run.activityAt, run.activitySinceMs, now))}${task}${signed}`;
}

/** What a directory's runs amount to, one line each.
 *
 * A directory where no run reports gets a sentence of its own, because
 * it is the state a reader is most tempted to read as "idle" — and a
 * session this product did not start writes no record at all.
 *
 * `now` counts each stated age from the record's timestamps. Without it,
 * the ages are the ones measured when the survey was read.
 *
 * `shownOnCards` names the runs a change's card already shows, by instance
 * id. They are not said a second time, and a directory whose every run is
 * on a card says so rather than that none reports
 * (a-card-says-what-its-change-is-doing). */
export function describeDirectoryRuns(
  directory: SurveyedDirectory,
  now?: Date,
  shownOnCards: ReadonlySet<string> = new Set(),
): string[] {
  const lines = directory.readable ? [] : [`could not be read: ${directory.reason}`];
  if (directory.runs.length === 0) return [...lines, "no run reports here"];
  const rest = directory.runs.filter((run) => !shownOnCards.has(run.instanceId));
  if (rest.length === 0) return [...lines, "every run here is on its change's card"];
  return [...lines, ...rest.map((run) => describeRun(run, now))];
}
