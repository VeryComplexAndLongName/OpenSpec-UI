// A working directory whose work has landed, and what happens to it
// (git-says-a-working-directory-is-done).
//
// Six working directories accumulated on one machine in one day, all of
// them for work that had landed hours before, all of them drawn as live
// work. The reading that should have caught them asked GitHub for a
// change's pull request, which needs a token, needs a change to hang the
// answer on, and says nothing at all when either is missing.
//
// git answers instead, offline, for every directory alike: a branch that
// was pushed and whose upstream is now gone is what a merged pull request
// leaves behind where the server deletes its branches on merge. And the
// answer is acted on rather than offered, because a press nobody
// remembers is a press nobody makes.
//
// Nothing here reads, moves or writes a change. A change is repository
// content; archiving one is a separate act with its own commit.

import { rm } from "node:fs/promises";

import type { BranchUpstream, GitWrapper } from "./git.js";
import type { ChangeStandings } from "./change-standing-facts.js";
import type { SurveyedDirectory, WorktreeSurvey } from "./worktree-survey-facts.js";

/** Why a directory is done with.
 *
 * `merged` is the survey's own answer, from a merge base; it holds for a
 * repository that does not squash. The other three are read here. */
export type FinishedReason =
  /** git: the branch was pushed and its upstream is gone. Needs no
   * network and no change. */
  | "branch-gone"
  /** The change's pull request merged, where pull requests could be
   * read. */
  | "pull-request-merged"
  /** The default branch carries that change archived. */
  | "archived-on-main"
  | "merged";

/** Why a directory was kept. Exactly one of these holds for each. */
export type KeptReason =
  | "main-working-directory"
  | "a-run-is-recorded"
  | "no-branch"
  | "branch-never-pushed"
  | "branch-still-on-the-server"
  | "uncommitted-work"
  | "the-fetch-failed"
  | "could-not-be-read";

interface DirectoryBase {
  path: string;
  label: string;
  branch?: string;
}

export interface FinishedDirectory extends DirectoryBase {
  /** The change whose standing settled it, where a standing did. */
  changeName?: string;
  reason: FinishedReason;
}

export interface KeptDirectory extends DirectoryBase {
  reason: KeptReason;
}

export interface WorkingDirectoryStates {
  finished: FinishedDirectory[];
  kept: KeptDirectory[];
}

/** The words a surface says. Here, so two surfaces cannot word the same
 * answer differently. */
export function describeFinished(reason: FinishedReason): string {
  switch (reason) {
    case "branch-gone":
      return "its branch is gone from the server";
    case "pull-request-merged":
      return "its pull request merged";
    case "archived-on-main":
      return "its change is archived on the default branch";
    case "merged":
      return "the default branch already contains its tip";
  }
}

export function describeKept(reason: KeptReason): string {
  switch (reason) {
    case "main-working-directory":
      return "it is the main working directory";
    case "a-run-is-recorded":
      return "a run is working in it";
    case "no-branch":
      return "it is not on a branch";
    case "branch-never-pushed":
      return "its branch was never pushed, so nothing of it landed";
    case "branch-still-on-the-server":
      return "its branch is still on the server";
    case "uncommitted-work":
      return "it holds uncommitted work";
    case "the-fetch-failed":
      return "the repository could not be fetched, so the answer would be stale";
    case "could-not-be-read":
      return "it could not be read";
  }
}

export interface WorkingDirectoryStateOptions {
  survey: WorktreeSurvey;
  /** Every local branch's upstream, from one `for-each-ref`. Absent
   * where the pruning fetch failed: then nothing is finished with, and
   * the failure is the reason. */
  upstreams?: readonly BranchUpstream[];
  /** Where the standings have been read, they settle two further cases.
   * They are never required: git alone answers. */
  standings?: ChangeStandings;
  /** Whether a directory's tree is clean. Asked only of a directory that
   * has passed everything else, so the cost follows the finished ones. */
  isClean: (directoryPath: string) => Promise<boolean>;
}

/** Every working directory, sorted into the ones that are done with and
 * the ones that are kept, each with the one reason that decided it.
 *
 * The order of the tests is the order of the answers: the first that
 * holds wins, so a directory with a run in it is kept for that reason
 * and not for a later one. */
export async function readWorkingDirectoryStates(
  options: WorkingDirectoryStateOptions,
): Promise<WorkingDirectoryStates> {
  const finished: FinishedDirectory[] = [];
  const kept: KeptDirectory[] = [];
  const upstreamOf = new Map((options.upstreams ?? []).map((entry) => [entry.branch, entry]));
  const byChange = new Map((options.standings?.standings ?? []).map((standing) => [standing.changeName, standing]));

  for (const directory of options.survey.directories) {
    const base: DirectoryBase = {
      path: directory.path,
      label: directory.label,
      ...(directory.branch !== undefined ? { branch: directory.branch } : {}),
    };
    const keep = (reason: KeptReason): void => { kept.push({ ...base, reason }); };

    if (directory.isMain) { keep("main-working-directory"); continue; }
    if (!directory.readable) { keep("could-not-be-read"); continue; }
    if (directory.runs.length > 0) { keep("a-run-is-recorded"); continue; }
    if (directory.branch === undefined) { keep("no-branch"); continue; }
    if (options.upstreams === undefined) { keep("the-fetch-failed"); continue; }

    const upstream = upstreamOf.get(directory.branch);
    if (upstream?.upstream === undefined) { keep("branch-never-pushed"); continue; }

    const reason = settle(directory, upstream, byChange);
    if (reason === undefined) { keep("branch-still-on-the-server"); continue; }
    if (!await options.isClean(directory.path)) { keep("uncommitted-work"); continue; }

    const changeName = changeOf(directory);
    finished.push({
      ...base,
      ...(changeName !== undefined ? { changeName } : {}),
      reason,
    });
  }

  return { finished, kept };
}

/** git first, the standings after: a directory should not stay for ever
 * because a token expired, and it should not stay for ever because its
 * change was withdrawn from the default branch either. */
function settle(
  directory: Extract<SurveyedDirectory, { readable: true }>,
  upstream: BranchUpstream,
  byChange: ReadonlyMap<string, { pullRequest?: { state: string }; main?: { kind: string } }>,
): FinishedReason | undefined {
  if (upstream.gone) return "branch-gone";
  const changeName = changeOf(directory);
  const standing = changeName === undefined ? undefined : byChange.get(changeName);
  if (standing?.pullRequest?.state === "MERGED") return "pull-request-merged";
  if (standing?.main?.kind === "archived") return "archived-on-main";
  return undefined;
}

/** The change a directory is for: the one it was cut for, or the one copy
 * it holds. Two changes in one directory settle nothing, since one of
 * them may still be under way. */
function changeOf(directory: Extract<SurveyedDirectory, { readable: true }>): string | undefined {
  return directory.belongsTo
    ?? (directory.changes.length === 1 ? directory.changes[0]?.changeName : undefined);
}

/** Removes the shell a worktree removal leaves behind on Windows, where
 * a link was inside it.
 *
 * A recursive delete is safe here, and that was tested on 2026-09-20
 * against a real junction: neither `git worktree remove --force` nor
 * this call follows one. The link is unlinked and what it points at -
 * for this repository, the main checkout's `node_modules` - is
 * untouched. The test that holds it is why nobody needs to rediscover
 * this. */
export async function removeDirectoryShell(directoryPath: string): Promise<void> {
  await rm(directoryPath, { recursive: true, force: true });
}

export interface SweepDeps {
  /** The repository's git, taken in the main working directory. */
  git: Pick<GitWrapper, "fetch" | "branchUpstreams" | "worktreeRemove"> & Partial<Pick<GitWrapper, "worktreePrune">>;
  /** Removes whatever shell the worktree removal left. A link inside it
   * is unlinked, never followed. Defaults to `removeDirectoryShell`. */
  removeShell?: (directoryPath: string) => Promise<void>;
  isClean: (directoryPath: string) => Promise<boolean>;
  /** The remote whose refs say whether a branch is still going. */
  remote?: string;
}

export interface SweptDirectory extends FinishedDirectory {
  /** Why it could not be removed, where it could not. */
  failed?: string;
}

export interface SweepResult {
  removed: SweptDirectory[];
  kept: KeptDirectory[];
  /** Why the fetch failed, where it did. Nothing is removed then. */
  fetchFailed?: string;
}

/** Reads and acts: fetches with pruning, sorts every working directory,
 * and removes the ones that are done with.
 *
 * A failed fetch removes nothing. `gone` appears only after a prune, so
 * a reading taken without one answers from whatever the last fetch left
 * behind - and a stale answer that removes something is worse than no
 * answer at all. */
export async function sweepFinishedDirectories(
  survey: WorktreeSurvey,
  deps: SweepDeps,
  standings?: ChangeStandings,
): Promise<SweepResult> {
  let upstreams: BranchUpstream[] | undefined;
  let fetchFailed: string | undefined;
  try {
    await deps.git.fetch(deps.remote ?? "origin", { prune: true });
    upstreams = await deps.git.branchUpstreams();
  } catch (error) {
    fetchFailed = error instanceof Error ? error.message : String(error);
  }

  const states = await readWorkingDirectoryStates({
    survey,
    ...(upstreams !== undefined ? { upstreams } : {}),
    ...(standings !== undefined ? { standings } : {}),
    isClean: deps.isClean,
  });

  const removed: SweptDirectory[] = [];
  for (const directory of states.finished) {
    // `--force`: the tree was read as clean above, and a directory
    // holding only ignored files - a module overlay, a downloaded editor -
    // is refused without it.
    let gitRefused: string | undefined;
    try {
      await deps.git.worktreeRemove(directory.path, { force: true });
    } catch (error) {
      gitRefused = error instanceof Error ? error.message : String(error);
    }
    // Whatever git left, whether or not it finished. git on Windows gives
    // up on a path longer than it can name - a downloaded editor in
    // `.vscode-test` is one - after forgetting the worktree and deleting
    // part of it, and the half it left behind was a directory no sweep
    // would ever look at again (the-sweep-finishes-what-it-starts). The
    // shell removal takes long paths, and unlinks a link without
    // following it.
    try {
      await (deps.removeShell ?? removeDirectoryShell)(directory.path);
      if (gitRefused !== undefined) await deps.git.worktreePrune?.();
      removed.push(directory);
    } catch (error) {
      removed.push({ ...directory, failed: gitRefused ?? (error instanceof Error ? error.message : String(error)) });
    }
  }

  return {
    removed,
    kept: states.kept,
    ...(fetchFailed !== undefined ? { fetchFailed } : {}),
  };
}
