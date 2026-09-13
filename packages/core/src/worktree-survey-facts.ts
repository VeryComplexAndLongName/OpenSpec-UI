// What every working directory of a repository holds, and what its runs
// say — the survey's shape, and the words it is described in.
//
// A leaf so the browser can have it: `worktree-survey.ts` reads the
// filesystem and lists git worktrees, and the shell needs only the shape
// and the wording. Type imports only, the move `change-readiness-facts`
// made for the same reason. See ADR 0026 and
// openspec/changes/what-the-others-are-doing.

import type { WorkspaceLeaseConflict } from "./workspace-lease.js";

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
  /** Milliseconds since the activity last changed. */
  activitySinceMs: number;
  /** Milliseconds since the record was last renewed. */
  heartbeatAgeMs: number;
  /** The heartbeat is past the staleness window: the writer is gone. */
  gone: boolean;
  workingDirectory: string;
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

/** One run in the words every surface uses. */
export function describeRun(run: SurveyedRun): string {
  const where = [run.changeName ?? undefined, run.stage ? `(${run.stage})` : undefined]
    .filter((part): part is string => part !== undefined)
    .join(" ");
  const prefix = where.length > 0 ? `${where}: ` : "";
  if (run.gone) {
    return `${prefix}gone — last heard from ${ago(run.heartbeatAgeMs)}, last said "${run.activity}"`;
  }
  return `${prefix}${run.activity} — said ${ago(run.activitySinceMs)}`;
}

/** What a directory's runs amount to, one line each.
 *
 * A directory where no run reports gets a sentence of its own, because
 * it is the state a reader is most tempted to read as "idle" — and a
 * session this product did not start writes no record at all. */
export function describeDirectoryRuns(directory: SurveyedDirectory): string[] {
  const lines = directory.readable ? [] : [`could not be read: ${directory.reason}`];
  if (directory.runs.length === 0) return [...lines, "no run reports here"];
  return [...lines, ...directory.runs.map(describeRun)];
}
