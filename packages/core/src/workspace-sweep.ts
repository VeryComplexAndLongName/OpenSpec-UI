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
import type { Forge } from "./gh-pr-gateway.js";
import { forgeFor } from "./forge.js";
import { createGitWrapper } from "./git.js";
import { archivesWhenLanded, followsMain, readGlobalHarnessConfig, rebasesWhenBehind, resolveHarnessConfig } from "./harness-config.js";
import { catchUpWithMain } from "./main-drift.js";
import { DEFAULT_BRANCH, DEFAULT_REMOTE } from "./main-drift-facts.js";
import { ARCHIVE_FOLLOW_INTERVAL_MS, archiveLandedChanges, describeLandedArchive, landedArchiveIsOpen, type LandedArchiveResult } from "./landed-archive.js";
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
  /** What became of the main working directory's default branch, where
   * there was something to say (main-follows-what-landed). */
  main?: MainFollowed;
}

/** The default branch brought up to its remote, or left behind and why. */
export type MainFollowed = { moved: number } | { behind: number; why: string };

async function followMainIn(workspaceRoot: string, survey: Awaited<ReturnType<typeof surveyWorktrees>>): Promise<MainFollowed | undefined> {
  // Only the checkout this host has open, only where it is the main one,
  // and never under a run working in it: moving its files would move them
  // under the run.
  const main = survey.directories.find((directory) => directory.isMain);
  if (main === undefined || !main.isThis || main.runs.length > 0) return undefined;
  // A checkout on another branch is somebody's choice, not something behind.
  if (!main.readable || main.branch !== DEFAULT_BRANCH) return undefined;
  try {
    if (!followsMain(await readGlobalHarnessConfig(workspaceRoot))) return undefined;
  } catch {
    return undefined;
  }
  const result = await catchUpWithMain({ root: workspaceRoot });
  if (result.ok) return result.moved > 0 ? { moved: result.moved } : undefined;
  // Refused: worth saying only where there is something to catch up with.
  const counts = await createGitWrapper({ cwd: workspaceRoot }).aheadBehind(DEFAULT_BRANCH, `${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`).catch(() => undefined);
  if (counts === undefined || counts.behind === 0) return undefined;
  return { behind: counts.behind, why: result.why };
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
    // GitHub, GitLab or Gitea, as `origin` says (the-forge-is-gitlab-or-gitea-too).
    forge: options.forge ?? await forgeFor(workspaceRoot),
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
  // An archive this pass merged is on the server and not yet in the refs
  // the fetch above left: fetched, so it reaches the checkout now rather
  // than a sweep later (ADR 0036).
  if (archive.followed?.outcome.state === "merged") await git.fetch("origin", { prune: true }).catch(() => undefined);
  // Last: what landed - an archive among it - comes to the checkout a
  // person watches, so the views show what the server has
  // (main-follows-what-landed).
  const followed = await followMainIn(workspaceRoot, await surveyWorktrees({ workspaceRoot }));
  return { ...sweep, archive, ...(followed !== undefined ? { main: followed } : {}) };
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
  if (sweep.main !== undefined) {
    lines.push("moved" in sweep.main
      ? `brought ${DEFAULT_BRANCH} up to ${DEFAULT_REMOTE}/${DEFAULT_BRANCH}: ${sweep.main.moved} commit${sweep.main.moved === 1 ? "" : "s"} that landed`
      : `${DEFAULT_BRANCH} is ${sweep.main.behind} commit${sweep.main.behind === 1 ? "" : "s"} behind ${DEFAULT_REMOTE}/${DEFAULT_BRANCH} and was left there: ${sweep.main.why}`);
  }
  return lines;
}

export interface ArchiveFollower {
  /** Looks at a sweep of a workspace, and sweeps it again in a few minutes
   * where it left an archive pull request open. */
  observe(workspaceRoot: string, sweep: WorkspaceSweep): void;
  dispose(): void;
}

/** Sweeps a workspace again every few minutes while its archive pull
 * request is open, so the product itself merges it soon after its checks
 * pass, whatever else asks for a sweep and however seldom (ADR 0036). One
 * timer per workspace. */
export function createArchiveFollower(options: {
  sweep?: (workspaceRoot: string) => Promise<WorkspaceSweep>;
  onSwept?: (workspaceRoot: string, sweep: WorkspaceSweep) => void;
  intervalMs?: number;
} = {}): ArchiveFollower {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const sweep = options.sweep ?? ((workspaceRoot: string) => sweepWorkspace(workspaceRoot));
  const follower: ArchiveFollower = {
    observe(workspaceRoot, swept) {
      if (!landedArchiveIsOpen(swept.archive) || timers.has(workspaceRoot)) return;
      const timer = setTimeout(() => {
        timers.delete(workspaceRoot);
        void sweep(workspaceRoot).then((again) => {
          options.onSwept?.(workspaceRoot, again);
          follower.observe(workspaceRoot, again);
        }, () => undefined);
      }, options.intervalMs ?? ARCHIVE_FOLLOW_INTERVAL_MS);
      timer.unref?.();
      timers.set(workspaceRoot, timer);
    },
    dispose() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
  return follower;
}

/** Why a behind branch was left alone, for a surface that lists them. */
export { describeRebaseSkipped };
