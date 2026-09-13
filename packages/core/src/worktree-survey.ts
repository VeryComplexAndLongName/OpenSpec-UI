// Every working directory of this repository, observed and never touched
// — ADR 0026, with its amendment for what their runs say (ADR 0028).
//
// Two git calls, both against the repository this host owns: one `git
// worktree list`, and this checkout's configured identity. Everything
// after that is a filesystem read — the names under each directory's
// `openspec/changes`, each `tasks.md`, each lease, each
// `.openspec-ui/worker.json`, and the status records every directory's
// runs share. No git is run in a directory this host does not own, and
// collisions are not computed for one: a git invocation per directory per
// read, answering a question its viewer cannot act on.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { agentStatusDirectory, readAgentStatuses, sweepAgentStatuses, type AgentStatusReport } from "./agent-status.js";
import { readChangeGraph } from "./change-graph.js";
import { createGitWrapper, type GitWorktree, type GitWrapper } from "./git.js";
import { readTaskChecklist } from "./task-checklist.js";
import { readWorkspaceLeaseHolder } from "./workspace-lease.js";
import { resolveWorktreeRoot, type WorktreeRootSources } from "./worktree-root.js";
import type { SurveyedChange, SurveyedDirectory, SurveyedRun, WorktreeSurvey } from "./worktree-survey-facts.js";

// The shape and the wording live in a leaf the browser can import; this
// file reads a repository to fill them in. Re-exported so an importer of
// this module needs nothing else.
export {
  describeDirectoryRuns,
  describeRun,
  type SurveyedChange,
  type SurveyedDirectory,
  type SurveyedRun,
  type WorktreeSurvey,
} from "./worktree-survey-facts.js";

/** Where a directory declares its own label. One field, self-declared. */
const WORKER_FILE = path.join(".openspec-ui", "worker.json");

/** A label is a name on a card, not a document. */
const LABEL_MAX_LENGTH = 80;

export interface WorktreeSurveyOptions {
  /** The directory the survey is taken from. */
  workspaceRoot: string;
  /** Test seam: a wrapper whose calls a test can count. Production builds
   * one on the repository. */
  git?: Pick<GitWrapper, "worktreeList" | "configuredIdentity">;
  /** Test seam for where the worktree root, and so the status directory,
   * is read from. */
  rootSources?: WorktreeRootSources;
  /** Test seam for the lease's and the status records' staleness window. */
  staleAfterMs?: number;
  /** Test seam for the status records' clock. */
  now?: () => Date;
  /** Removes records of runs that will never write again before reading
   * the rest (a-stale-status-is-swept). Off unless asked for: a survey is
   * a reading, and a caller that polls the directory anyway — the
   * Pipeline tab — asks for it. The sweep is filesystem-only, so it adds
   * no git invocation. */
  sweepStatuses?: boolean;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

/** A path as two paths are compared: resolved, and case-folded where the
 * filesystem folds case. git spells a Windows path with forward slashes
 * and a status record with backslashes, and both name one directory. */
function pathKey(target: string): string {
  const resolved = path.resolve(target);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function whyUnreadable(directory: string): Promise<string | undefined> {
  try {
    const info = await stat(directory);
    return info.isDirectory() ? undefined : "it is not a directory";
  } catch (error) {
    return isMissing(error) ? "it does not exist" : message(error);
  }
}

async function readDeclaredLabel(directory: string): Promise<string | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path.join(directory, WORKER_FILE), "utf8")) as { label?: unknown };
    if (typeof parsed.label !== "string") return undefined;
    const label = parsed.label.trim();
    return label.length > 0 ? label.slice(0, LABEL_MAX_LENGTH) : undefined;
  } catch {
    // Absent, unreadable or not JSON: the directory declares nothing, and
    // its own name still names it.
    return undefined;
  }
}

async function activeChangeNames(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(path.join(directory, "openspec", "changes"), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && entry.name !== "archive").map((entry) => entry.name).sort();
  } catch (error) {
    // A working directory with no OpenSpec in it has no queue, which is a
    // true answer rather than a failure to read one.
    if (isMissing(error)) return [];
    throw error;
  }
}

async function surveyChanges(directory: string): Promise<SurveyedChange[]> {
  const names = await activeChangeNames(directory);
  if (names.length === 0) return [];
  const active = new Set(names);

  let blockedBy = new Map<string, string[]>();
  try {
    const graph = await readChangeGraph(directory);
    blockedBy = new Map([...graph].map(([id, node]) => [id, node.blockedBy]));
  } catch {
    // A picture without its relations still shows every change, which is
    // most of what it is for.
    blockedBy = new Map();
  }

  const changes: SurveyedChange[] = [];
  for (const changeName of names) {
    const blockers = (blockedBy.get(changeName) ?? []).filter((name) => active.has(name) && name !== changeName);
    try {
      const items = await readTaskChecklist(directory, changeName, false);
      changes.push({
        changeName,
        tasksDone: items.filter((item) => item.done).length,
        tasksTotal: items.length,
        blockers,
        alsoIn: [],
      });
    } catch (error) {
      changes.push({ changeName, tasksDone: 0, tasksTotal: 0, tasksUnreadable: message(error), blockers, alsoIn: [] });
    }
  }
  return changes;
}

function toRun(report: AgentStatusReport): SurveyedRun {
  return {
    instanceId: report.instanceId,
    changeName: report.changeName,
    stage: report.stage,
    activity: report.activity,
    activitySinceMs: report.activitySinceMs,
    heartbeatAgeMs: report.heartbeatAgeMs,
    activityAt: report.activityAt,
    heartbeatAt: report.heartbeatAt,
    gone: report.gone,
    workingDirectory: report.workingDirectory,
  };
}

/** Each directory with the runs whose records name it, and the records
 * that name no directory of the list.
 *
 * Pure: the matching the survey does, apart from reading anything, so the
 * records can be re-read and laid over a list of directories read earlier
 * (`refreshSurveyRuns`). A record is matched by path, never guessed onto
 * a directory it does not name. */
export function attachRunsToDirectories(
  directories: readonly SurveyedDirectory[],
  reports: readonly AgentStatusReport[],
): { directories: SurveyedDirectory[]; runsElsewhere: SurveyedRun[] } {
  const claimed = new Set<AgentStatusReport>();
  const attached = directories.map((directory) => {
    const key = pathKey(directory.path);
    const runs = reports.filter((report) => pathKey(report.workingDirectory) === key);
    for (const report of runs) claimed.add(report);
    return { ...directory, runs: runs.map(toRun) };
  });
  return {
    directories: attached,
    runsElsewhere: reports.filter((report) => !claimed.has(report)).map(toRun),
  };
}

/** The status records of the repository whose main directory is
 * `mainPath`, or why they could not be read. Filesystem only. */
async function readStatusReports(
  mainPath: string,
  options: Pick<WorktreeSurveyOptions, "rootSources" | "staleAfterMs" | "now" | "sweepStatuses">,
): Promise<{ reports: AgentStatusReport[]; runsUnreadable?: string }> {
  try {
    const { root } = await resolveWorktreeRoot(mainPath, options.rootSources ?? {});
    const statusDirectory = agentStatusDirectory(root, mainPath);
    const clock = {
      ...(options.now ? { now: options.now } : {}),
      ...(options.staleAfterMs !== undefined ? { staleAfterMs: options.staleAfterMs } : {}),
    };
    // Best-effort: a sweep that fails leaves the reading to report what is
    // there.
    if (options.sweepStatuses) await sweepAgentStatuses(statusDirectory, clock).catch(() => undefined);
    const read = await readAgentStatuses(statusDirectory, clock);
    return { reports: read.reports };
  } catch (error) {
    return { reports: [], runsUnreadable: message(error) };
  }
}

/** Every working directory of the repository `workspaceRoot` belongs to:
 * its label, branch, changes and their task counts, who holds it where a
 * mutating run does, and what its runs say they are doing.
 *
 * Nothing here is inferred about whether anybody is working, stuck or
 * idle. A directory that cannot be read is reported as such and does not
 * remove the others. */
export async function surveyWorktrees(options: WorktreeSurveyOptions): Promise<WorktreeSurvey> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const git = options.git ?? createGitWrapper({ cwd: workspaceRoot });
  const leaseOptions = options.staleAfterMs !== undefined ? { staleAfterMs: options.staleAfterMs } : {};

  let worktrees: GitWorktree[];
  try {
    worktrees = await git.worktreeList();
  } catch {
    worktrees = [];
  }
  // Not a git repository, or git unavailable: the directory being looked
  // at is still one directory, and saying so is more useful than nothing.
  if (worktrees.length === 0) worktrees = [{ path: workspaceRoot }];

  let thisAuthor: string | undefined;
  try {
    thisAuthor = await git.configuredIdentity();
  } catch {
    thisAuthor = undefined;
  }

  // Located from the list already held rather than by
  // `resolveAgentStatusDirectory`, which would list the worktrees again.
  const mainPath = (worktrees[0] as GitWorktree).path;
  const { reports, runsUnreadable } = await readStatusReports(mainPath, options);

  const thisKey = pathKey(workspaceRoot);
  const directories: SurveyedDirectory[] = [];

  for (const [index, worktree] of worktrees.entries()) {
    const key = pathKey(worktree.path);
    const declared = await readDeclaredLabel(worktree.path);
    const base = {
      path: worktree.path,
      label: declared ?? path.basename(path.resolve(worktree.path)),
      labelDeclared: declared !== undefined,
      isMain: index === 0,
      isThis: key === thisKey,
      ...(worktree.branch ? { branch: worktree.branch } : {}),
      ...(worktree.head ? { head: worktree.head } : {}),
      runs: [],
    };

    const unreadable = await whyUnreadable(worktree.path);
    if (unreadable !== undefined) {
      directories.push({ ...base, readable: false, reason: unreadable });
      continue;
    }

    let changes: SurveyedChange[];
    try {
      changes = await surveyChanges(worktree.path);
    } catch (error) {
      directories.push({ ...base, readable: false, reason: message(error) });
      continue;
    }

    const holder = await readWorkspaceLeaseHolder(worktree.path, leaseOptions);
    directories.push({
      ...base,
      readable: true,
      changes,
      ...(holder ? { holder } : {}),
      authorDiffers: holder?.author !== undefined && thisAuthor !== undefined && holder.author !== thisAuthor,
    });
  }

  // One change in several directories: every holder is named from every
  // other, and nothing is refused or resolved.
  const pathsByChange = new Map<string, string[]>();
  for (const directory of directories) {
    if (!directory.readable) continue;
    for (const change of directory.changes) {
      pathsByChange.set(change.changeName, [...(pathsByChange.get(change.changeName) ?? []), directory.path]);
    }
  }
  for (const directory of directories) {
    if (!directory.readable) continue;
    for (const change of directory.changes) {
      change.alsoIn = (pathsByChange.get(change.changeName) ?? []).filter((other) => other !== directory.path);
    }
  }

  const attached = attachRunsToDirectories(directories, reports);
  return {
    directories: attached.directories,
    runsElsewhere: attached.runsElsewhere,
    ...(runsUnreadable !== undefined ? { runsUnreadable } : {}),
    ...(thisAuthor !== undefined ? { thisAuthor } : {}),
  };
}

/** Options for re-reading a survey's runs. `git` is accepted so a test can
 * pass one that throws, and is never called: the point of this reading is
 * that it runs no git. */
export type SurveyRunsRefreshOptions = Omit<WorktreeSurveyOptions, "workspaceRoot">;

/** `survey`, with its runs read again from the status records and laid
 * over the directories it already lists — the-pipeline-opens-in-vs-code.
 *
 * A status record is rewritten every few seconds while a run is alive,
 * and a full survey lists git worktrees each time. Re-reading only the
 * records answers "what are the runs saying now" without git; the list
 * of directories, their changes and their leases stay as the survey read
 * them, and a host re-surveys on its own slower schedule. */
export async function refreshSurveyRuns(
  survey: WorktreeSurvey,
  options: SurveyRunsRefreshOptions = {},
): Promise<WorktreeSurvey> {
  const main = survey.directories.find((directory) => directory.isMain) ?? survey.directories[0];
  if (main === undefined) return survey;

  const { reports, runsUnreadable } = await readStatusReports(main.path, options);
  const attached = attachRunsToDirectories(survey.directories, reports);
  // Why the records could not be read belongs to this reading, not to
  // the one the survey was taken with.
  return {
    directories: attached.directories,
    runsElsewhere: attached.runsElsewhere,
    ...(runsUnreadable !== undefined ? { runsUnreadable } : {}),
    ...(survey.thisAuthor !== undefined ? { thisAuthor: survey.thisAuthor } : {}),
  };
}
