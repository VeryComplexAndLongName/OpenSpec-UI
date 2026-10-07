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
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Forge } from "./gh-pr-gateway.js";
import { forgeFor } from "./forge.js";
import { createGitWrapper } from "./git.js";
import { claimDirectoryBeside, releaseClaim, takeClaim } from "./resource-claim.js";
import { resolveAgentStatusDirectory } from "./agent-status.js";
import { archivesWhenLanded, followsMain, readGlobalHarnessConfig, rebasesWhenBehind, resolveHarnessConfig } from "./harness-config.js";
import { catchUpWithMain } from "./main-drift.js";
import { DEFAULT_BRANCH, DEFAULT_REMOTE } from "./main-drift-facts.js";
import { ARCHIVE_FOLLOW_INTERVAL_MS, archiveLandedChanges, describeLandedArchive, failureReason, landedArchiveIsOpen, type LandedArchiveResult } from "./landed-archive.js";
import { archiveChange } from "./openspec.js";
import { removeTree } from "./plain-fs.js";
import { changeNamesKnown, clearWorktreeShells, type ShellSweep } from "./workspace-leftovers.js";
import { resolveWorktreeRoot } from "./worktree-root.js";
import { surveyWorktrees } from "./worktree-survey.js";

export interface WorkspaceSweep {
  directories: SweepResult;
  /** What an earlier pass left behind under the worktree root, and what
   * became of it this time. Absent where there was nothing
   * (the-sweep-comes-back-for-what-it-left). */
  shells?: ShellSweep;
  /** Absent where the pruning fetch failed: a rebase from a stale reading
   * of the server is exactly what the lease exists to refuse, and there is
   * no point asking it to. */
  branches?: RebaseSweepResult;
  /** Absent where the server could not be read, no change was finished
   * (ADR 0035), or another host holds the archive claim. */
  archive?: LandedArchiveResult;
  /** Who was archiving while this pass wanted to: the archive was left to
   * them rather than attempted beside them
   * (the-sweep-finishes-the-archive-it-opened). */
  archiveHeldBy?: string;
  /** What became of the main working directory's default branch, where
   * there was something to say (main-follows-what-landed). */
  main?: MainFollowed;
  /** The changes worked in a directory of their own whose branch is on the
   * server: each is in review, or about to be, and lands when its pull
   * request merges. A host sweeps again soon while there are any, so the
   * archive follows a merge by minutes (landed-changes-are-archived-without-waiting). */
  awaitingLanding?: string[];
  /** Why the server could not be read by a pass with no working directory
   * to sweep, so nothing was archived. Said, since a change that landed
   * then waits with nobody told why (landed-changes-are-archived-without-waiting). */
  archiveUnread?: string;
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

/** Comes back for what an earlier pass could not delete.
 *
 * The worktrees directory is read directly rather than through the
 * survey: a removal that half-finished leaves a shell git has already
 * forgotten, and a survey of what git lists can never see it again. Until
 * now this ran only when somebody pressed the standalone's tidy button,
 * and only on a shell that was empty - so the one kind of shell a removal
 * actually leaves, the kind holding a file that was locked, sat there for
 * good (the-sweep-comes-back-for-what-it-left). */
async function sweepWhatWasLeft(
  workspaceRoot: string,
  survey: Awaited<ReturnType<typeof surveyWorktrees>>,
): Promise<ShellSweep> {
  // Named for the main checkout, whichever directory this host is in:
  // every working directory of one repository sits under one name
  // (ADR 0027).
  const main = survey.directories.find((directory) => directory.isMain)?.path ?? workspaceRoot;
  const { root } = await resolveWorktreeRoot(main);
  return clearWorktreeShells(
    path.join(root, path.basename(path.resolve(main))),
    survey.directories.map((directory) => directory.path),
    await changeNamesKnown(workspaceRoot),
  );
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

/** The resource one archive pass at a time holds.
 *
 * Two hosts sweeping one workspace within a minute of each other each
 * opened an archive pull request for the same two changes on 2026-09-23
 * (#729 and #730, 43 seconds apart): each had read the forge's branches
 * before either had pushed, so neither could see the other
 * (the-sweep-finishes-the-archive-it-opened). */
export const ARCHIVE_CLAIM = "archive";

/** Runs the archive pass while this host holds the claim, and says who
 * holds it where somebody else does.
 *
 * Advisory, as every claim here is: a host that never asks holds nothing
 * back, and a claim expires by heartbeat, so a host that died mid-pass
 * does not stop the next one for ever. It coordinates the hosts on one
 * machine, which is where the editor and the standalone both sweep; two
 * machines are a question this cannot answer and does not pretend to.
 *
 * Anything that goes wrong reaching the claim leaves the pass as it was
 * before claims: archiving is the point, and coordination is the help. */
async function whileHoldingTheArchive<T>(
  workspaceRoot: string,
  run: () => Promise<T>,
): Promise<{ ran: true; value: T } | { ran: false; heldBy: string }> {
  let directory: string | undefined;
  try {
    directory = claimDirectoryBeside(
      await resolveAgentStatusDirectory(createGitWrapper({ cwd: workspaceRoot }), workspaceRoot),
    );
  } catch {
    return { ran: true, value: await run() };
  }
  const taken = await takeClaim({
    directory,
    resource: ARCHIVE_CLAIM,
    holder: os.userInfo().username,
    machine: os.hostname(),
  }).catch(() => undefined);
  if (taken === undefined) return { ran: true, value: await run() };
  if (!taken.taken) return { ran: false, heldBy: taken.held.holder };
  try {
    return { ran: true, value: await run() };
  } finally {
    await releaseClaim(directory, ARCHIVE_CLAIM).catch(() => undefined);
  }
}

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
    // default branch. The archive waits for a pass that can read the
    // server, and says why it waits: a change that landed sat unarchived
    // for as long as a fetch kept failing, and nobody was told
    // (landed-changes-are-archived-without-waiting).
    try {
      await git.fetch("origin", { prune: true });
    } catch (error) {
      return { ...NOTHING, archiveUnread: failureReason(error) };
    }
  }

  const attempt = await whileHoldingTheArchive(workspaceRoot, async () => archiveLandedChanges({
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
        remove: () => removeTree(parent),
      };
    },
  }));
  const archive = attempt.ran ? attempt.value : undefined;
  const archiveHeldBy = attempt.ran ? undefined : attempt.heldBy;
  // An archive this pass merged is on the server and not yet in the refs
  // the fetch above left: fetched, so it reaches the checkout now rather
  // than a sweep later (ADR 0036).
  if (archive?.followed?.outcome.state === "merged") await git.fetch("origin", { prune: true }).catch(() => undefined);
  // Last: what landed - an archive among it - comes to the checkout a
  // person watches, so the views show what the server has
  // (main-follows-what-landed).
  const last = await surveyWorktrees({ workspaceRoot });
  const followed = await followMainIn(workspaceRoot, last);
  // After everything above, so a directory this pass removed is gone from
  // the survey before what was left behind is looked for.
  const shells = await sweepWhatWasLeft(workspaceRoot, last)
    .catch((): ShellSweep => ({ removed: [], kept: [], failures: [] }));
  const saidAnything = shells.removed.length > 0 || shells.failures.length > 0;
  const awaitingLanding = await changesAwaitingLanding(git, last);
  return {
    ...sweep,
    ...(archive !== undefined ? { archive } : {}),
    ...(archiveHeldBy !== undefined ? { archiveHeldBy } : {}),
    ...(saidAnything ? { shells } : {}),
    ...(followed !== undefined ? { main: followed } : {}),
    ...(awaitingLanding.length > 0 ? { awaitingLanding } : {}),
  };
}

/** The changes worked in a directory of their own whose branch is on the
 * server, read from the refs the fetch left: offline, one ref listing. A
 * branch that is gone, or merged, is not waiting for anything. */
async function changesAwaitingLanding(
  git: Pick<ReturnType<typeof createGitWrapper>, "listRefs">,
  survey: Awaited<ReturnType<typeof surveyWorktrees>>,
): Promise<string[]> {
  const prefix = `refs/remotes/${DEFAULT_REMOTE}/`;
  const onServer = new Set((await git.listRefs([`refs/remotes/${DEFAULT_REMOTE}`]).catch(() => []))
    .filter((ref) => ref.name.startsWith(prefix))
    .map((ref) => ref.name.slice(prefix.length)));
  return survey.directories.flatMap((directory) =>
    !directory.isMain && directory.ownChange !== undefined && directory.branch !== undefined
      && directory.finishedWith === undefined && onServer.has(directory.branch)
      ? [directory.ownChange]
      : []);
}

/** Whether a host sweeps a workspace again in a few minutes rather than at
 * its usual half hour (ADR 0036; landed-changes-are-archived-without-waiting):
 * - an archive pull request is open, and is followed until it merges;
 * - one was merged by this pass: the changes that landed while it was
 *   open were left waiting by it, and are due now;
 * - the archive failed for a reason the previous pass did not give - a
 *   refused push is often gone a minute later, and a failure that repeats
 *   is left to the usual interval rather than retried for ever;
 * - a change's own branch is on the server, so its merge is seen, and its
 *   archive made, minutes after it happens.
 * `previous` is the host's last sweep of the same workspace, where it has
 * one. */
export function sweepsAgainSoon(sweep: WorkspaceSweep, previous?: WorkspaceSweep): boolean {
  const archive = sweep.archive;
  if (landedArchiveIsOpen(archive)) return true;
  const followed = archive?.followed;
  if (followed?.outcome.state === "merged") {
    const before = previous?.archive?.followed;
    if (!(before?.outcome.state === "merged" && before.number === followed.number)) return true;
  }
  if (archive?.failed !== undefined && archive.failed !== previous?.archive?.failed) return true;
  return (sweep.awaitingLanding?.length ?? 0) > 0;
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
    lines.push(`nothing was removed, rebased or archived: ${describeKept("the-fetch-failed")} (${sweep.directories.fetchFailed})`);
  }
  if (sweep.archiveUnread !== undefined) {
    lines.push(`nothing was archived: the repository could not be fetched, so what landed could not be read (${sweep.archiveUnread})`);
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
  for (const shell of sweep.shells?.removed ?? []) {
    lines.push(`removed what an earlier pass left behind of ${shell.name}`);
  }
  for (const failure of sweep.shells?.failures ?? []) {
    lines.push(`what an earlier pass left behind of ${failure.name} is still there: ${failure.reason}; it will be asked again`);
  }
  if (sweep.archiveHeldBy !== undefined) {
    lines.push(`left the archive to ${sweep.archiveHeldBy}, who is archiving this workspace now`);
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

/** Sweeps a workspace again in a few minutes wherever `sweepsAgainSoon`
 * says so - while its archive pull request is open, so the product itself
 * merges it soon after its checks pass (ADR 0036), and while a change is
 * about to land, so its archive follows by minutes
 * (landed-changes-are-archived-without-waiting) - whatever else asks for a
 * sweep and however seldom. One timer per workspace. */
export function createArchiveFollower(options: {
  sweep?: (workspaceRoot: string) => Promise<WorkspaceSweep>;
  onSwept?: (workspaceRoot: string, sweep: WorkspaceSweep) => void;
  intervalMs?: number;
} = {}): ArchiveFollower {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const previous = new Map<string, WorkspaceSweep>();
  const sweep = options.sweep ?? ((workspaceRoot: string) => sweepWorkspace(workspaceRoot));
  const follower: ArchiveFollower = {
    observe(workspaceRoot, swept) {
      const before = previous.get(workspaceRoot);
      previous.set(workspaceRoot, swept);
      if (!sweepsAgainSoon(swept, before) || timers.has(workspaceRoot)) return;
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
      previous.clear();
    },
  };
  return follower;
}

/** Why a behind branch was left alone, for a surface that lists them. */
export { describeRebaseSkipped };
