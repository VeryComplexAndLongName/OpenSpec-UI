// A change's branch that has fallen behind is rebased for you (ADR 0034,
// a-behind-branch-is-rebased-for-you).
//
// Since main-no-longer-requires-an-up-to-date-branch a behind branch can
// merge, and two pull requests green apart can be broken together. The
// remedy is dull - rebase, push, let the checks run again - and on
// 2026-09-20 an agent did it by hand after every merge, with a person
// noticing each time that it was due.
//
// This does it, and only where nothing can be lost: every rail below is
// checked, not assumed, and the push is leased against the upstream as it
// was read, so a push somebody else made in the meantime refuses this one
// rather than being overwritten. A conflict is never resolved.

import type { BranchUpstream, GitWrapper } from "./git.js";
import type { SurveyedDirectory, WorktreeSurvey } from "./worktree-survey-facts.js";

/** Why a directory's branch was not rebased. Exactly one holds. */
export type RebaseSkippedReason =
  | "turned-off"
  | "not-a-change-branch"
  | "never-pushed"
  | "gone-from-the-server"
  | "uncommitted-work"
  | "a-run-is-recorded"
  | "ahead-of-its-upstream"
  | "behind-its-upstream"
  | "up-to-date"
  | "could-not-be-read";

export interface RebasedBranch {
  path: string;
  branch: string;
  onto: string;
  /** How many commits of the default branch it was behind. */
  behind: number;
}

export interface ConflictedBranch {
  path: string;
  branch: string;
  onto: string;
  /** The files in conflict. The rebase was aborted; the branch is as it
   * was. */
  conflicts: string[];
}

export interface FailedBranch {
  path: string;
  branch: string;
  /** What went wrong after the rebase itself succeeded - usually the
   * lease refusing a push because somebody else pushed first. */
  reason: string;
}

export interface SkippedBranch {
  path: string;
  branch?: string;
  reason: RebaseSkippedReason;
}

export interface RebaseSweepResult {
  rebased: RebasedBranch[];
  conflicted: ConflictedBranch[];
  failed: FailedBranch[];
  skipped: SkippedBranch[];
}

/** The words a surface says, here so two hosts cannot word them apart. */
export function describeRebaseSkipped(reason: RebaseSkippedReason): string {
  switch (reason) {
    case "turned-off":
      return "rebasing is turned off for its change (branches.rebaseWhenBehind)";
    case "not-a-change-branch":
      return "its branch is not named after a change, so this product leaves it alone";
    case "never-pushed":
      return "its branch was never pushed";
    case "gone-from-the-server":
      return "its branch is gone from the server";
    case "uncommitted-work":
      return "it holds uncommitted work";
    case "a-run-is-recorded":
      return "a run is working in it";
    case "ahead-of-its-upstream":
      return "it has commits the server does not, so a push would carry new work";
    case "behind-its-upstream":
      return "the server has commits it does not; pull them first";
    case "up-to-date":
      return "it is not behind";
    case "could-not-be-read":
      return "it could not be read";
  }
}

export interface RebaseDeps {
  /** A git wrapper taken in a given working directory. The rebase runs
   * where the branch is checked out, which is the only place it can. */
  gitIn: (directoryPath: string) => Pick<GitWrapper, "aheadBehind" | "rebaseOnto" | "pushWithLease" | "resolveCommit" | "restoreTo">;
  isClean: (directoryPath: string) => Promise<boolean>;
  /** Every branch's upstream, read once, after the pruning fetch the
   * directory sweep already made. */
  upstreams: readonly BranchUpstream[];
  remote?: string;
  defaultBranch?: string;
  /** Whether the change a branch is for allows it, from its resolved
   * harness configuration: the workspace's setting, and the change's own
   * where it has one. Asked with the directory the branch is checked out
   * in, since a change in flight has its `harness.json` there and not yet
   * on the default branch. Absent means every change allows it, which is
   * the default (ADR 0034). */
  allowed?: (changeName: string, directoryPath: string) => Promise<boolean>;
}

/** A branch this product named: it bears the name of a change the
 * directory holds (ADR 0022, and the reading `ownChangeOf` uses). A branch
 * named anything else is somebody's own, and is never touched. */
export function isChangeBranch(directory: Extract<SurveyedDirectory, { readable: true }>): boolean {
  if (directory.branch === undefined) return false;
  if (directory.belongsTo === directory.branch) return true;
  return directory.changes.some((change) => change.changeName === directory.branch);
}

/** Rebases every change's branch that has fallen behind and can be moved
 * without losing anything, and says what it did with each. */
export async function rebaseBehindBranches(survey: WorktreeSurvey, deps: RebaseDeps): Promise<RebaseSweepResult> {
  const remote = deps.remote ?? "origin";
  const onto = `${remote}/${deps.defaultBranch ?? "main"}`;
  const upstreamOf = new Map(deps.upstreams.map((entry) => [entry.branch, entry]));
  const result: RebaseSweepResult = { rebased: [], conflicted: [], failed: [], skipped: [] };

  for (const directory of survey.directories) {
    const skip = (reason: RebaseSkippedReason): void => {
      result.skipped.push({ path: directory.path, ...(directory.branch !== undefined ? { branch: directory.branch } : {}), reason });
    };

    if (!directory.readable) { skip("could-not-be-read"); continue; }
    if (!isChangeBranch(directory)) { skip("not-a-change-branch"); continue; }
    const branch = directory.branch as string;
    if (deps.allowed !== undefined && !await deps.allowed(branch, directory.path)) { skip("turned-off"); continue; }
    if (directory.runs.length > 0) { skip("a-run-is-recorded"); continue; }

    const upstream = upstreamOf.get(branch);
    if (upstream?.upstream === undefined) { skip("never-pushed"); continue; }
    if (upstream.gone) { skip("gone-from-the-server"); continue; }

    const git = deps.gitIn(directory.path);
    // The branch must equal its upstream. Nothing of it may exist only
    // here - a push after a rebase would carry it, and this setting must
    // never push new work - and nothing of the server's may be missing
    // here either.
    const againstUpstream = await git.aheadBehind(branch, upstream.upstream);
    if (againstUpstream === undefined) { skip("could-not-be-read"); continue; }
    if (againstUpstream.ahead > 0) { skip("ahead-of-its-upstream"); continue; }
    // The server has something this copy lacks - pushed from another
    // machine. Rebasing past it would leave the lease guarding a commit
    // the branch never had here; the person pulls first.
    if (againstUpstream.behind > 0) { skip("behind-its-upstream"); continue; }

    const againstDefault = await git.aheadBehind(branch, onto);
    if (againstDefault === undefined) { skip("could-not-be-read"); continue; }
    if (againstDefault.behind === 0) { skip("up-to-date"); continue; }

    // Asked last: the only call here that reads a whole working tree.
    if (!await deps.isClean(directory.path)) { skip("uncommitted-work"); continue; }

    // The lease is taken against the upstream as it is now, before the
    // rebase moves anything.
    const leased = await git.resolveCommit(upstream.upstream);
    if (leased === undefined) { skip("could-not-be-read"); continue; }

    const rebased = await git.rebaseOnto(onto);
    if (!rebased.ok) {
      // A conflict names its files. A rebase that failed without any -
      // no committer identity, a hook that refused - is a failure, and
      // saying "conflict" for it would send a person looking for files
      // that are not there. Either way it was aborted and nothing moved.
      if (rebased.conflicts.length > 0) {
        result.conflicted.push({ path: directory.path, branch, onto, conflicts: rebased.conflicts });
      } else {
        result.failed.push({ path: directory.path, branch, reason: `the rebase stopped: ${rebased.reason}` });
      }
      continue;
    }

    try {
      await git.pushWithLease(remote, branch, leased);
      result.rebased.push({ path: directory.path, branch, onto, behind: againstDefault.behind });
    } catch (error) {
      // The push was refused - most often the lease, because somebody else
      // pushed first. The branch goes back exactly where it was: the tree
      // was clean and the branch equal to its upstream before the rebase,
      // so the leased commit is its old tip and nothing is lost.
      const reason = error instanceof Error ? error.message.trim() : String(error);
      try {
        await git.restoreTo(leased);
        result.failed.push({ path: directory.path, branch, reason });
      } catch (restoreError) {
        const why = restoreError instanceof Error ? restoreError.message.trim() : String(restoreError);
        result.failed.push({ path: directory.path, branch, reason: `${reason}; and it could not be put back: ${why}` });
      }
    }
  }

  return result;
}
