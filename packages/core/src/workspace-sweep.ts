// The sweep every host runs over a workspace's working directories
// (a-behind-branch-is-rebased-for-you).
//
// Three jobs, one pass: remove the directories whose work has landed
// (git-says-a-working-directory-is-done), rebase the change branches that
// have fallen behind (ADR 0034), and archive the changes that have landed
// with nothing open (ADR 0035). One function, so the editor and the
// standalone cannot drift into doing different things with the same
// working directories - which is what had already happened: after
// git-says-a-working-directory-is-done the editor removed a finished
// directory and the standalone only offered to.

import { isChangeBranch, rebaseBehindBranches, describeRebaseSkipped, type RebaseSweepResult } from "./branch-rebase.js";
import { describeFinished, describeKept, sweepFinishedDirectories, type SweepResult } from "./finished-directories.js";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createGitHubForge, type Forge } from "./gh-pr-gateway.js";
import { createGitWrapper } from "./git.js";
import { archivesWhenLanded, rebasesWhenBehind, resolveHarnessConfig } from "./harness-config.js";
import { archiveLandedChanges, describeLandedArchive, type LandedArchiveResult } from "./landed-archive.js";
import { archiveChange } from "./openspec.js";
import { surveyWorktrees } from "./worktree-survey.js";

export interface WorkspaceSweep {
  directories: SweepResult;
  /** Absent where the pruning fetch failed: a rebase from a stale reading
   * of the server is exactly what the lease exists to refuse, and there is
   * no point asking it to. */
  branches?: RebaseSweepResult;
  /** Absent where the server could not be read, or no change was
   * finished (ADR 0035). */
  archive?: LandedArchiveResult;
}

export interface WorkspaceSweepOptions {
  /** Test seam: the forge the archive pass asks. GitHub through `gh` by
   * default. */
  forge?: Forge;
  /** Test seam: runs `openspec archive`. */
  archive?: (changeName: string, directoryPath: string) => Promise<void>;
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

/** Removes what is done, rebases what is behind, and archives what has
 * landed.
 *
 * Nothing is asked of a repository with no remote at all: it would be
 * told, on every interval, that its remote could not be fetched. The
 * forge is asked only where the default branch holds a change that could
 * be finished (ADR 0035). */
export async function sweepWorkspace(workspaceRoot: string, options: WorkspaceSweepOptions = {}): Promise<WorkspaceSweep> {
  const git = createGitWrapper({ cwd: workspaceRoot });
  if (await git.remoteUrl("origin") === undefined) return NOTHING;
  const first = await surveyWorktrees({ workspaceRoot });
  const anything = first.directories.some((directory) =>
    !directory.isMain || (directory.readable && isChangeBranch(directory)));

  let sweep: WorkspaceSweep = NOTHING;
  if (anything) {
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
    sweep = { directories, branches };
  } else {
    // Nothing above fetched, and the archive is read from the server's
    // default branch. A failed fetch is not news on every interval: the
    // archive simply waits for a pass that can read the server.
    try {
      await git.fetch("origin", { prune: true });
    } catch {
      return NOTHING;
    }
  }

  const archive = await archiveLandedChanges({
    git,
    gitIn: (directoryPath) => createGitWrapper({ cwd: directoryPath }),
    forge: options.forge ?? createGitHubForge({ cwd: workspaceRoot }),
    archive: options.archive ?? (async (changeName, directoryPath) => {
      await archiveChange(changeName, { cwd: directoryPath });
    }),
    allowed: async (changeName) => {
      try {
        return archivesWhenLanded(await resolveHarnessConfig(workspaceRoot, changeName));
      } catch {
        return false;
      }
    },
    // Outside the workspace, so no survey counts it as one of its working
    // directories while it exists.
    makeDirectory: async () => {
      const parent = await mkdtemp(path.join(os.tmpdir(), "openspec-archive-"));
      return {
        path: path.join(parent, "tree"),
        remove: () => rm(parent, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
      };
    },
  });
  return { ...sweep, archive };
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
  if (sweep.archive) lines.push(...describeLandedArchive(sweep.archive));
  return lines;
}

/** Why a behind branch was left alone, for a surface that lists them. */
export { describeRebaseSkipped };
