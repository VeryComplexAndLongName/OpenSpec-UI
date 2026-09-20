// Reading where every change stands — ADR 0026's amendment of 2026-09-13.
//
// One reading across the repository: this checkout's copies and every other
// working directory's (from the survey), the main ref, each change's own
// branch, and, where `gh` can be read, the branch's pull request. Every git
// call runs against this repository. The fetch is slow and stated: a reading
// says when refs were last fetched and whether that failed, and never fetches
// in a loop.

import path from "node:path";
import {
  countTaskCheckboxes,
  type ChangeStanding,
  type ChangeStandings,
  type StandingCopy,
  type StandingOnMain,
  type StandingSources,
} from "./change-standing-facts.js";
import { listPullRequestsByBranch, type PullRequestsByBranch } from "./gh-pr-gateway.js";
import { createGitWrapper, type GitWrapper } from "./git.js";
import { surveyWorktrees, type SurveyedDirectory, type WorktreeSurvey } from "./worktree-survey.js";
import { standingRunsOf } from "./worktree-survey-facts.js";

export * from "./change-standing-facts.js";

/** How often a view that shows standings fetches, at most. */
export const STANDING_FETCH_INTERVAL_MS = 5 * 60_000;

/** When a reading fetches: never, now, or when refs are older than an
 * interval. */
export type StandingFetch = "never" | "now" | { ifOlderThan: number };

export interface ChangeStandingOptions {
  fetch?: StandingFetch;
  /** The remote whose refs are read. Defaults to `origin`. */
  remote?: string;
  /** Test seams. */
  git?: Pick<GitWrapper, "listTreeNames" | "showFile" | "listRefs" | "resolveCommit" | "fetch" | "lastFetchedAt" | "mergeBase" | "remoteUrl">;
  listPullRequests?: (cwd: string) => Promise<PullRequestsByBranch>;
  survey?: (workspaceRoot: string) => Promise<WorktreeSurvey>;
  now?: () => Date;
}

const CHANGES = "openspec/changes";
const ARCHIVE_NAME = /^\d{4}-\d{2}-\d{2}-(.+)$/u;

function message(error: unknown): string {
  return error instanceof Error ? error.message.split(/\r?\n/)[0] ?? error.message : String(error);
}

/** When each repository last tried to fetch, so a failing fetch is not
 * tried again on every reading. */
const lastFetchAttempt = new Map<string, number>();

/** The last pull request reading of each repository, read again only when
 * this reading fetched or none is held. */
const pullRequestReadings = new Map<string, PullRequestsByBranch>();

/** What a commit holds never changes, so a tree, a file or a merge base read
 * from commits is kept by the repository and the commits' ids. A reading
 * after the first then runs git only to list refs and name HEAD, until a ref
 * moves (task 9.1). The repository is part of the key so that two
 * repositories whose commits happen to share an id never answer for each
 * other. */
const readFromCommits = new Map<string, unknown>();
const READ_FROM_COMMITS_LIMIT = 5_000;

async function fromCommits<T>(key: string, read: () => Promise<T>): Promise<T> {
  if (readFromCommits.has(key)) return readFromCommits.get(key) as T;
  const value = await read();
  if (readFromCommits.size >= READ_FROM_COMMITS_LIMIT) readFromCommits.clear();
  readFromCommits.set(key, value);
  return value;
}

function copyOf(directory: SurveyedDirectory, changeName: string): StandingCopy | undefined {
  if (!directory.readable) return undefined;
  const change = directory.changes.find((candidate) => candidate.changeName === changeName);
  if (change === undefined) return undefined;
  return {
    label: directory.label,
    path: directory.path,
    ...(directory.branch !== undefined ? { branch: directory.branch } : {}),
    ...(change.tasksUnreadable === undefined ? { counts: { done: change.tasksDone, total: change.tasksTotal } } : {}),
    runs: standingRunsOf(directory.runs, changeName),
  };
}

async function maybeFetch(
  git: NonNullable<ChangeStandingOptions["git"]>,
  key: string,
  mode: StandingFetch,
  remote: string,
  now: Date,
): Promise<StandingSources["fetch"]> {
  if (mode === "never") return { attempted: false };
  if (await git.remoteUrl(remote) === undefined) return { attempted: false };
  if (mode !== "now") {
    const last = Math.max((await git.lastFetchedAt())?.getTime() ?? 0, lastFetchAttempt.get(key) ?? 0);
    if (now.getTime() - last < mode.ifOlderThan) return { attempted: false };
  }
  lastFetchAttempt.set(key, now.getTime());
  const at = now.toISOString();
  try {
    await git.fetch(remote);
    return { attempted: true, at };
  } catch (error) {
    return { attempted: true, at, failed: message(error) };
  }
}

/** Where every change of this checkout and of every other working directory
 * stands. */
export async function readChangeStandings(workspaceRoot: string, options: ChangeStandingOptions = {}): Promise<ChangeStandings> {
  const root = path.resolve(workspaceRoot);
  const now = (options.now ?? (() => new Date()))();
  const remote = options.remote ?? "origin";
  const git = options.git ?? createGitWrapper({ cwd: root });

  const survey = await (options.survey ?? ((cwd: string) => surveyWorktrees({ workspaceRoot: cwd })))(root);
  const fetch = await maybeFetch(git, root, options.fetch ?? "never", remote, now);

  let pullRequests = pullRequestReadings.get(root);
  if (pullRequests === undefined || fetch.attempted || options.listPullRequests !== undefined) {
    pullRequests = await (options.listPullRequests ?? ((cwd: string) => listPullRequestsByBranch({ cwd })))(root);
    pullRequestReadings.set(root, pullRequests);
  }

  const lastFetched = await git.lastFetchedAt();
  const sources: StandingSources = {
    fetch,
    pullRequests: pullRequests.available ? { read: true } : { read: false, why: pullRequests.reason },
    ...(lastFetched !== undefined ? { lastFetchedAt: lastFetched.toISOString() } : {}),
  };

  // Every change named in a working directory.
  const thisDirectory = survey.directories.find((directory) => directory.isThis);
  const names = new Set<string>();
  for (const directory of survey.directories) {
    if (directory.readable) for (const change of directory.changes) names.add(change.changeName);
  }

  let commits = new Map<string, string>();
  let mainRef: string | undefined;
  let mainCommit: string | undefined;
  let activeOnMain = new Set<string>();
  const archivedOnMain = new Map<string, string>();
  let atMergeBase = new Set<string>();
  try {
    commits = new Map((await git.listRefs(["refs/heads", `refs/remotes/${remote}`])).map((ref) => [ref.name, ref.commit]));
    const mainName = commits.has(`refs/remotes/${remote}/main`) ? `refs/remotes/${remote}/main` : commits.has("refs/heads/main") ? "refs/heads/main" : undefined;
    if (mainName !== undefined) {
      mainRef = mainName === "refs/heads/main" ? "main" : `${remote}/main`;
      mainCommit = commits.get(mainName) as string;
      sources.mainRef = mainRef;
      const main = mainCommit;
      activeOnMain = new Set((await fromCommits(`${root}|${main}:${CHANGES}`, () => git.listTreeNames(main, CHANGES))).filter((name) => name !== "archive"));
      for (const archived of await fromCommits(`${root}|${main}:${CHANGES}/archive`, () => git.listTreeNames(main, `${CHANGES}/archive`))) {
        const match = ARCHIVE_NAME.exec(archived);
        if (match?.[1] !== undefined) archivedOnMain.set(match[1], archived);
      }
      const head = await git.resolveCommit("HEAD");
      const base = head === undefined ? undefined : await fromCommits(`${root}|base:${main}:${head}`, () => git.mergeBase(main, head));
      if (base !== undefined) atMergeBase = new Set(await fromCommits(`${root}|${base}:${CHANGES}`, () => git.listTreeNames(base, CHANGES)));
    }
  } catch (error) {
    sources.refsUnreadable = message(error);
    mainRef = undefined;
    mainCommit = undefined;
  }

  const tasksAt = (commit: string, changeName: string) =>
    fromCommits(`${root}|${commit}:${CHANGES}/${changeName}/tasks.md`, () => git.showFile(commit, `${CHANGES}/${changeName}/tasks.md`));

  const standings: ChangeStanding[] = [];
  for (const changeName of [...names].sort()) {
    const here = thisDirectory ? copyOf(thisDirectory, changeName) : undefined;
    const elsewhere = survey.directories
      .filter((directory) => !directory.isThis)
      .map((directory) => copyOf(directory, changeName))
      .filter((copy): copy is StandingCopy => copy !== undefined);

    let main: StandingOnMain | undefined;
    if (mainCommit !== undefined && sources.refsUnreadable === undefined) {
      if (activeOnMain.has(changeName)) {
        const text = await tasksAt(mainCommit, changeName);
        main = { kind: "active", ...(text !== undefined ? { counts: countTaskCheckboxes(text) } : {}) };
      } else if (archivedOnMain.has(changeName)) {
        main = { kind: "archived", archiveName: archivedOnMain.get(changeName) as string };
      } else if (atMergeBase.has(changeName)) {
        main = { kind: "deleted" };
      } else {
        main = { kind: "absent" };
      }
    }

    const localCommit = commits.get(`refs/heads/${changeName}`);
    const remoteCommit = commits.get(`refs/remotes/${remote}/${changeName}`);
    let branch: ChangeStanding["branch"];
    const branchCommit = remoteCommit ?? localCommit;
    if (branchCommit !== undefined) {
      const text = await tasksAt(branchCommit, changeName);
      branch = {
        name: changeName,
        local: localCommit !== undefined,
        remote: remoteCommit !== undefined,
        ...(text !== undefined ? { counts: countTaskCheckboxes(text) } : {}),
      };
    }

    const pullRequest = pullRequests.available ? pullRequests.byBranch.get(changeName) : undefined;
    standings.push({
      changeName,
      ...(here !== undefined ? { here } : {}),
      elsewhere,
      ...(main !== undefined ? { main } : {}),
      ...(branch !== undefined ? { branch } : {}),
      ...(pullRequest !== undefined ? { pullRequest } : {}),
    });
  }

  return { readAt: now.toISOString(), standings, sources };
}

/** Why a working directory has nothing left to do. The first two are what
 * settle it in a repository that squashes its pull requests; the last two
 * are the survey's own cheap signals (what-is-finished-is-tidied-away). */
// One union, declared beside the reading that acts on it
// (git-says-a-working-directory-is-done).
export type { FinishedDirectory, FinishedReason } from "./finished-directories.js";
import type { FinishedDirectory, FinishedReason } from "./finished-directories.js";

/** Every working directory whose work has landed.
 *
 * A squashed pull request never makes a branch's tip an ancestor of the
 * default branch, so the survey's merge base answers "not finished" for
 * work that plainly is. What settles it is already read here: the pull
 * request, and whether the default branch carries the change archived.
 *
 * The main working directory is never included - it is where the default
 * branch lives - and neither is a directory with a run recorded against
 * it. A directory the survey already called finished with is included on
 * the survey's word, since that word was given with its tree read as
 * clean; one settled by a standing has its tree read here, and only
 * there, so nothing pays for a git call it does not need. */
export async function finishedWorkingDirectories(
  survey: WorktreeSurvey,
  standings: ChangeStandings,
  options: { isClean?: (directoryPath: string) => Promise<boolean> } = {},
): Promise<FinishedDirectory[]> {
  const byChange = new Map(standings.standings.map((standing) => [standing.changeName, standing]));
  const isClean = options.isClean ?? (async (directoryPath: string) => {
    try {
      return (await createGitWrapper({ cwd: directoryPath }).status()).isClean;
    } catch {
      return false;
    }
  });

  const finished: FinishedDirectory[] = [];
  for (const directory of survey.directories) {
    if (directory.isMain || !directory.readable || directory.runs.length > 0) continue;
    const base = {
      path: directory.path,
      label: directory.label,
      ...(directory.branch !== undefined ? { branch: directory.branch } : {}),
    };

    if (directory.finishedWith !== undefined) {
      finished.push({ ...base, reason: directory.finishedWith.reason });
      continue;
    }

    // The change this directory is for: the one it was cut for, or the one
    // copy it holds. Two changes in one directory settle nothing, since
    // one of them may still be under way.
    const changeName = directory.belongsTo
      ?? (directory.changes.length === 1 ? directory.changes[0]?.changeName : undefined);
    if (changeName === undefined) continue;
    const standing = byChange.get(changeName);
    if (standing === undefined) continue;

    const reason: FinishedReason | undefined = standing.pullRequest?.state === "MERGED"
      ? "pull-request-merged"
      : standing.main?.kind === "archived"
        ? "archived-on-main"
        : undefined;
    if (reason === undefined) continue;
    if (!await isClean(directory.path)) continue;
    finished.push({ ...base, changeName, reason });
  }
  return finished;
}
