// A change that has landed and owes nothing is archived for you (ADR 0035).
//
// Read from the default branch as the server has it: a change whose
// directory is still in `openspec/changes/` there, whose task list there
// is closed item by item, and whose own pull request is not open, is
// finished and not yet archived. Every such change goes into one pull
// request per pass, made in a directory of its own outside the workspace.
// The pass follows that pull request itself and merges it once its checks
// have decided (ADR 0036): no forge is asked to merge later by its own
// rules, so the same thing happens on every forge, however the repository
// is set up. While one is open, no other is made. Where the forge refuses
// it because the default branch moved on - a repository that merges only
// what is up to date with it - the pass makes the archive again on the
// default branch as it is now and updates its own branch
// (an-archive-keeps-up-with-main).

import type { GitWrapper } from "./git.js";
import { isMergeMethodRefusal, PENDING_REASON, type Forge, type MergeMethod, type PullRequestRef } from "./gh-pr-gateway.js";
import { describeTaskDebts, owesNothing, parseTaskChecklist } from "./task-checklist.js";

const CHANGES = "openspec/changes";

/** The prefix of every branch this pass makes, and the one it waits on. */
export const LANDED_ARCHIVE_BRANCH_PREFIX = "archive-landed-";

export interface LandedArchiveDeps {
  /** Git in the workspace's own repository. */
  git: Pick<GitWrapper, "listTreeNames" | "showFile" | "worktreeAdd" | "worktreeRemove" | "deleteBranch" | "aheadBehind" | "resolveCommit">;
  /** Git in the directory the archive is made in. */
  gitIn: (directoryPath: string) => Pick<GitWrapper, "stagePath" | "commit" | "push" | "pushWithLease">;
  forge: Forge;
  /** Runs `openspec archive` for one change in the given directory. */
  archive: (changeName: string, directoryPath: string) => Promise<void>;
  /** Whether this change may be archived for you, by its configuration. */
  allowed: (changeName: string) => Promise<boolean>;
  /** A path, not yet existing, for the directory the archive is made in,
   * and how to remove what is left of it afterwards. */
  makeDirectory: () => Promise<{ path: string; remove: () => Promise<void> }>;
  now?: () => Date;
  remote?: string;
  defaultBranch?: string;
}

export interface LandedArchiveResult {
  /** The changes that were due, in the order they were found. */
  due: string[];
  /** The pull request this pass opened. Its checks are read from the next
   * pass on: a moment after opening, a forge may not yet have started the
   * checks it will run, and would read as having none. */
  opened?: {
    branch: string;
    pullRequest: PullRequestRef;
    changes: string[];
  };
  /** An archive pull request already open, which this pass followed, and
   * what came of it. While it is open, no other is made. */
  followed?: {
    branch: string;
    number: number;
    outcome: ArchiveFollowOutcome;
  };
  /** A change that was due and was not archived, and why. */
  notArchived: Array<{ changeName: string; reason: string }>;
  /** A change whose own pull request has merged while it still owes
   * something: never archived, and said, because the merge gate should
   * have made it impossible. */
  owing: Array<{ changeName: string; pullRequest: number; owes: string[] }>;
  /** Why the pass could do nothing at all, where it had something to do. */
  failed?: string;
}

/** What following an open archive pull request came to.
 * - `merged`: this pass merged it.
 * - `waiting`: its checks are still running.
 * - `blocked`: a check failed, its checks could not be read, or the forge
 *   refused the merge, with the forge's own reason. The pass reads it again
 *   next time, and merges it once it can.
 * - `rebuilt`: the forge refused it and the default branch had moved on, so
 *   the archive was made again on the default branch and its branch
 *   updated; its checks run again, and the next pass follows them. */
export type ArchiveFollowOutcome =
  | { state: "merged"; method: MergeMethod }
  | { state: "waiting" }
  | { state: "blocked"; reason: string; cause: "check-failed" | "checks-unreadable" | "refused" }
  | { state: "rebuilt"; behind: number };

/** How often a host sweeps while an archive pull request is open: its
 * checks are read that often, and it is merged that soon after they pass. */
export const ARCHIVE_FOLLOW_INTERVAL_MS = 5 * 60_000;

/** Whether a pass left an archive pull request open that the next pass
 * will follow - what a host re-sweeps sooner for (ADR 0036). */
export function landedArchiveIsOpen(result: LandedArchiveResult | undefined): boolean {
  if (!result) return false;
  return result.opened !== undefined || (result.followed !== undefined && result.followed.outcome.state !== "merged");
}

/** The methods tried, in this order: a repository allows some of them, and
 * squash keeps one commit per archive on the default branch. */
const ARCHIVE_MERGE_METHODS: readonly MergeMethod[] = ["squash", "merge", "rebase"];

/** Reads an archive pull request's checks and merges it where they have
 * decided. Where no check ran it merges too: an archive only moves
 * directories `openspec archive` wrote, and a repository with no checks
 * would otherwise keep it open forever. */
export async function followArchivePullRequest(forge: Forge, number: number): Promise<ArchiveFollowOutcome> {
  let checks;
  try {
    checks = await forge.checksOf(number);
  } catch (error) {
    return { state: "blocked", reason: `its checks could not be read: ${errorText(error)}`, cause: "checks-unreadable" };
  }
  if (checks.state === "none" && checks.reason === PENDING_REASON) return { state: "waiting" };
  if (checks.state === "fail") return { state: "blocked", reason: checks.reason ?? "a check failed", cause: "check-failed" };
  let reason = "no merge method was tried";
  for (const method of ARCHIVE_MERGE_METHODS) {
    try {
      await forge.mergeNow(number, method);
      return { state: "merged", method };
    } catch (error) {
      reason = errorText(error);
      if (!isMergeMethodRefusal(reason)) break;
    }
  }
  return { state: "blocked", reason: `${forge.name} refused the merge: ${reason}`, cause: "refused" };
}

function stamp(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

/** What an archive pull request is called: the changes it archives, by
 * name, so the list of pull requests says what each one is. Two named in
 * full; more, the first two and how many besides. */
export function landedArchiveTitle(changes: readonly string[]): string {
  if (changes.length <= 2) return `Archive ${changes.join(" and ")}`;
  return `Archive ${changes.slice(0, 2).join(", ")} and ${changes.length - 2} more`;
}

function lines(...parts: string[]): string {
  return parts.join(String.fromCharCode(10));
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const first = text.split(String.fromCharCode(10)).map((line) => line.trim()).find((line) => line.length > 0);
  return first ?? "no reason given";
}

/** Makes the archive of `changes` on a branch cut from `base`, in a
 * directory of its own, commits it and hands the branch to `push`. Returns
 * the changes it archived; one whose archive fails is left out and named.
 * The directory and the local branch are removed whatever happens. */
async function makeArchive(
  deps: LandedArchiveDeps,
  branch: string,
  base: string,
  changes: readonly string[],
  notArchived: LandedArchiveResult["notArchived"],
  push: (git: ReturnType<LandedArchiveDeps["gitIn"]>) => Promise<void>,
): Promise<string[]> {
  const directory = await deps.makeDirectory();
  let checkedOut = false;
  try {
    // A local branch of this name left by a pass that could not clean up
    // would refuse the checkout; it is this pass's own, and nothing of it
    // is needed.
    await deps.git.deleteBranch(branch).catch(() => undefined);
    await deps.git.worktreeAdd({ path: directory.path, branch, base });
    checkedOut = true;

    const archived: string[] = [];
    for (const name of changes) {
      try {
        await deps.archive(name, directory.path);
        archived.push(name);
      } catch (error) {
        notArchived.push({ changeName: name, reason: errorText(error) });
      }
    }
    if (archived.length === 0) return archived;

    const git = deps.gitIn(directory.path);
    await git.stagePath("openspec");
    const committed = await git.commit(lines(
      landedArchiveTitle(archived),
      "",
      ...archived.map((name) => `- ${name}`),
      "",
      "Opened by the workspace sweep: each landed with nothing open (ADR 0035).",
    ));
    // git commits nothing, and says so without failing, where nothing was
    // staged. The branch would then be the default branch under another
    // name, and a pull request of it would archive nothing
    // (the-sweep-finishes-what-it-starts).
    if (!committed.commit) throw new Error("archiving changed nothing, so there was nothing to commit");
    await push(git);
    return archived;
  } finally {
    // The directory and the local branch are this pass's own, and nothing
    // of them is needed once the branch is on the server - or once it
    // could not be put there, when the next pass starts again from the
    // default branch.
    if (checkedOut) {
      await deps.git.worktreeRemove(directory.path, { force: true }).catch(() => undefined);
      await deps.git.deleteBranch(branch).catch(() => undefined);
    }
    await directory.remove().catch(() => undefined);
  }
}

/** Archives every change that has landed and owes nothing, in one pull
 * request, and says what it did. */
export async function archiveLandedChanges(deps: LandedArchiveDeps): Promise<LandedArchiveResult> {
  const remote = deps.remote ?? "origin";
  const defaultBranch = deps.defaultBranch ?? "main";
  const ref = `${remote}/${defaultBranch}`;
  const result: LandedArchiveResult = { due: [], notArchived: [], owing: [] };

  const names = (await deps.git.listTreeNames(ref, CHANGES)).filter((name) => name !== "archive");
  const closed: string[] = [];
  const debts = new Map<string, string[]>();
  for (const name of names) {
    const tasks = await deps.git.showFile(ref, `${CHANGES}/${name}/tasks.md`);
    const items = parseTaskChecklist(tasks ?? "");
    const owed = describeTaskDebts(items);
    if (items.length > 0 && owesNothing(owed)) {
      closed.push(name);
    } else if (items.length > 0) {
      debts.set(name, [
        ...owed.open.map((item) => `still open: ${item}`),
        ...owed.unrecorded.map((item) => `closed with nothing written under it: ${item}`),
      ]);
    }
  }
  // Nothing finished, and nothing that could have landed owing: the forge
  // is not asked, so a pass over an ordinary workspace costs two git reads
  // per change and no network.
  if (closed.length === 0 && debts.size === 0) return result;

  const pullRequests = await deps.forge.pullRequestsByBranch();
  if (!pullRequests.available) {
    if (closed.length > 0) result.failed = `${deps.forge.name} could not be asked about pull requests: ${pullRequests.reason}`;
    return result;
  }
  const byBranch = pullRequests.byBranch;

  for (const [name, owes] of debts) {
    const own = byBranch.get(name);
    if (own?.state === "MERGED") result.owing.push({ changeName: name, pullRequest: own.number, owes });
  }

  for (const name of closed) {
    const own = byBranch.get(name);
    if (own?.state === "OPEN") continue;
    if (!await deps.allowed(name)) continue;
    result.due.push(name);
  }

  // An archive pull request already open is followed first, whatever is
  // due now: it holds changes that were due when it was made. After it
  // merges, the next pass reads a default branch without them.
  for (const [branch, pullRequest] of byBranch) {
    if (branch.startsWith(LANDED_ARCHIVE_BRANCH_PREFIX) && pullRequest.state === "OPEN") {
      let outcome = await followArchivePullRequest(deps.forge, pullRequest.number);
      // Refused while the default branch has moved on: a repository that
      // merges only what is up to date with it would refuse it on every
      // pass from now on. The archive is mechanical, so it is made again on
      // the default branch as it is, and its own branch is moved there with
      // a lease - a push somebody else made meanwhile refuses this one.
      if (outcome.state === "blocked" && outcome.cause === "refused" && result.due.length > 0) {
        const refused = outcome;
        const remoteBranch = `${remote}/${branch}`;
        const behind = (await deps.git.aheadBehind(remoteBranch, ref))?.behind ?? 0;
        const leased = behind > 0 ? await deps.git.resolveCommit(remoteBranch) : undefined;
        if (leased !== undefined) {
          try {
            const archived = await makeArchive(deps, branch, ref, result.due, result.notArchived, (git) => git.pushWithLease(remote, branch, leased));
            if (archived.length > 0) outcome = { state: "rebuilt", behind };
          } catch (error) {
            outcome = { ...refused, reason: `${refused.reason}; making it again on ${ref} failed too: ${errorText(error)}` };
          }
        }
      }
      result.followed = { branch, number: pullRequest.number, outcome };
      return result;
    }
  }
  if (result.due.length === 0) return result;

  const branch = `${LANDED_ARCHIVE_BRANCH_PREFIX}${stamp((deps.now ?? (() => new Date()))())}`;
  try {
    const archived = await makeArchive(deps, branch, ref, result.due, result.notArchived, (git) => git.push(remote, branch));
    if (archived.length === 0) return result;

    const pullRequest = await deps.forge.openPullRequest({
      head: branch,
      base: defaultBranch,
      title: landedArchiveTitle(archived),
      body: lines(
        "Every change below has landed on the default branch with every task item closed, so it is archived here.",
        "",
        ...archived.map((name) => `- \`${name}\``),
        "",
        "Opened by the workspace sweep (ADR 0035). The sweep follows it and merges it itself once its checks pass, or where none run (ADR 0036); the merge gate holds each change to the rule it was archived by.",
      ),
    });
    result.opened = { branch, pullRequest, changes: archived };
    return result;
  } catch (error) {
    result.failed = errorText(error);
    return result;
  }
}

/** What a pass did, in the sentences every host says. Nothing where
 * nothing happened. */
export function describeLandedArchive(result: LandedArchiveResult): string[] {
  const said: string[] = [];
  if (result.opened) {
    const { pullRequest, changes } = result.opened;
    said.push(`opened #${pullRequest.number} to archive ${changes.join(", ")}, which landed with nothing open`);
    said.push(`#${pullRequest.number} is merged by the sweep once its checks pass`);
  }
  if (result.followed) {
    const { number, outcome } = result.followed;
    if (outcome.state === "merged") said.push(`merged #${number} by ${outcome.method}: its checks passed, or none ran`);
    else if (outcome.state === "waiting") said.push(`#${number} is waiting for its checks`);
    else if (outcome.state === "rebuilt") {
      said.push(`#${number} was refused while ${outcome.behind} commit${outcome.behind === 1 ? "" : "s"} behind the default branch, so the archive was made again on it and pushed; its checks run again`);
    } else said.push(`#${number} cannot merge yet: ${outcome.reason}`);
  }
  for (const entry of result.notArchived) {
    said.push(`could not archive ${entry.changeName}: ${entry.reason}`);
  }
  for (const entry of result.owing) {
    said.push(`${entry.changeName} landed in #${entry.pullRequest} but still owes ${entry.owes.length === 1 ? "an item" : `${entry.owes.length} items`}, so it stays live: ${entry.owes.join("; ")}`);
  }
  if (result.failed) said.push(`nothing was archived: ${result.failed}`);
  return said;
}
