// The sweep every host runs over a workspace's working directories
// (a-behind-branch-is-rebased-for-you).
//
// Two jobs, one pass: remove the directories whose work has landed
// (git-says-a-working-directory-is-done), then rebase the change branches
// that have fallen behind (ADR 0034). One function, so the editor and the
// standalone cannot drift into doing different things with the same
// working directories - which is what had already happened: after
// git-says-a-working-directory-is-done the editor removed a finished
// directory and the standalone only offered to.

import { isChangeBranch, rebaseBehindBranches, describeRebaseSkipped, type RebaseSweepResult } from "./branch-rebase.js";
import { describeFinished, describeKept, sweepFinishedDirectories, type SweepResult } from "./finished-directories.js";
import { createGitWrapper } from "./git.js";
import { rebasesWhenBehind, resolveHarnessConfig } from "./harness-config.js";
import { surveyWorktrees } from "./worktree-survey.js";

export interface WorkspaceSweep {
  directories: SweepResult;
  /** Absent where the pruning fetch failed: a rebase from a stale reading
   * of the server is exactly what the lease exists to refuse, and there is
   * no point asking it to. */
  branches?: RebaseSweepResult;
}

async function isClean(directoryPath: string): Promise<boolean> {
  try {
    return (await createGitWrapper({ cwd: directoryPath }).status()).isClean;
  } catch {
    return false;
  }
}

/** A sweep that did nothing, and said nothing. */
const NOTHING: WorkspaceSweep = { directories: { removed: [], kept: [] } };

/** Removes what is done, then rebases what is behind.
 *
 * Nothing is asked of the server where there is nothing to act on: a
 * workspace with no working directory but its own and no change branch
 * checked out, or a repository with no remote at all. Otherwise a
 * repository that never had a remote would be told, on every interval,
 * that its remote could not be fetched. */
export async function sweepWorkspace(workspaceRoot: string): Promise<WorkspaceSweep> {
  const git = createGitWrapper({ cwd: workspaceRoot });
  const first = await surveyWorktrees({ workspaceRoot });
  const anything = first.directories.some((directory) =>
    !directory.isMain || (directory.readable && isChangeBranch(directory)));
  if (!anything) return NOTHING;
  if (await git.remoteUrl("origin") === undefined) return NOTHING;

  const directories = await sweepFinishedDirectories(first, { git, isClean });
  if (directories.fetchFailed !== undefined) return { directories };

  // Surveyed again: the directories just removed are not there to rebase.
  const survey = await surveyWorktrees({ workspaceRoot });
  const branches = await rebaseBehindBranches(survey, {
    gitIn: (directoryPath) => createGitWrapper({ cwd: directoryPath }),
    isClean,
    upstreams: await git.branchUpstreams(),
    allowed: async (changeName, directoryPath) => {
      try {
        return rebasesWhenBehind(await resolveHarnessConfig(directoryPath, changeName));
      } catch {
        // A configuration that cannot be read allows nothing it could not
        // be asked about: the default is on, but an unreadable file is not
        // somebody saying so.
        return false;
      }
    },
  });
  return { directories, branches };
}

/** What a sweep did, in the sentences every host says. Nothing is said
 * where nothing happened: a sweep that found everything in order is not
 * news. */
export function describeWorkspaceSweep(sweep: WorkspaceSweep): string[] {
  const lines: string[] = [];
  for (const directory of sweep.directories.removed) {
    lines.push(directory.failed === undefined
      ? `removed the working directory ${directory.label}: ${describeFinished(directory.reason)}`
      : `could not remove the working directory ${directory.label}: ${directory.failed}`);
  }
  if (sweep.directories.fetchFailed !== undefined) {
    lines.push(`nothing was removed or rebased: ${describeKept("the-fetch-failed")} (${sweep.directories.fetchFailed})`);
  }
  for (const branch of sweep.branches?.rebased ?? []) {
    lines.push(`rebased ${branch.branch} onto ${branch.onto} (${branch.behind} behind) and pushed it; its checks will run again`);
  }
  for (const branch of sweep.branches?.conflicted ?? []) {
    lines.push(`${branch.branch} needs a rebase by hand: it conflicts with ${branch.onto} in ${branch.conflicts.join(", ")}; it was left as it was`);
  }
  for (const branch of sweep.branches?.failed ?? []) {
    lines.push(`${branch.branch} was not rebased, and is as it was: ${branch.reason}`);
  }
  return lines;
}

/** Why a behind branch was left alone, for a surface that lists them. */
export { describeRebaseSkipped };
