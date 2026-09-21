// A change that has landed and owes nothing is archived for you (ADR 0035).
//
// Read from the default branch as the server has it: a change whose
// directory is still in `openspec/changes/` there, whose task list there
// is closed item by item, and whose own pull request is not open, is
// finished and not yet archived. Every such change goes into one pull
// request per pass, made in a directory of its own outside the workspace
// and asked to merge when its checks pass. While one is open, no other is
// made.

import type { GitWrapper } from "./git.js";
import type { Forge, PullRequestRef } from "./gh-pr-gateway.js";
import { describeTaskDebts, owesNothing, parseTaskChecklist } from "./task-checklist.js";

const CHANGES = "openspec/changes";

/** The prefix of every branch this pass makes, and the one it waits on. */
export const LANDED_ARCHIVE_BRANCH_PREFIX = "archive-landed-";

export interface LandedArchiveDeps {
  /** Git in the workspace's own repository. */
  git: Pick<GitWrapper, "listTreeNames" | "showFile" | "worktreeAdd" | "worktreeRemove" | "deleteBranch">;
  /** Git in the directory the archive is made in. */
  gitIn: (directoryPath: string) => Pick<GitWrapper, "stagePath" | "commit" | "push">;
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
  /** The pull request this pass opened, and what the forge said to the
   * request that it merge when its checks pass. */
  opened?: {
    branch: string;
    pullRequest: PullRequestRef;
    changes: string[];
    merge: { ok: true; method: string } | { ok: false; reason: string };
  };
  /** An archive pull request already open, which this pass waited on. */
  waitingFor?: { branch: string; number: number };
  /** A change that was due and was not archived, and why. */
  notArchived: Array<{ changeName: string; reason: string }>;
  /** A change whose own pull request has merged while it still owes
   * something: never archived, and said, because the merge gate should
   * have made it impossible. */
  owing: Array<{ changeName: string; pullRequest: number; owes: string[] }>;
  /** Why the pass could do nothing at all, where it had something to do. */
  failed?: string;
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
  if (result.due.length === 0) return result;

  for (const [branch, pullRequest] of byBranch) {
    if (branch.startsWith(LANDED_ARCHIVE_BRANCH_PREFIX) && pullRequest.state === "OPEN") {
      result.waitingFor = { branch, number: pullRequest.number };
      return result;
    }
  }

  const branch = `${LANDED_ARCHIVE_BRANCH_PREFIX}${stamp((deps.now ?? (() => new Date()))())}`;
  const directory = await deps.makeDirectory();
  let checkedOut = false;
  try {
    await deps.git.worktreeAdd({ path: directory.path, branch, base: ref });
    checkedOut = true;

    const archived: string[] = [];
    for (const name of result.due) {
      try {
        await deps.archive(name, directory.path);
        archived.push(name);
      } catch (error) {
        result.notArchived.push({ changeName: name, reason: errorText(error) });
      }
    }
    if (archived.length === 0) return result;

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
    await git.push(remote, branch);

    const pullRequest = await deps.forge.openPullRequest({
      head: branch,
      base: defaultBranch,
      title: landedArchiveTitle(archived),
      body: lines(
        "Every change below has landed on the default branch with every task item closed, so it is archived here.",
        "",
        ...archived.map((name) => `- \`${name}\``),
        "",
        "Opened by the workspace sweep (ADR 0035). It merges when its checks pass; the merge gate holds each change to the rule it was archived by.",
      ),
    });
    const merge = await deps.forge.mergeWhenChecksPass(pullRequest.number);
    result.opened = { branch, pullRequest, changes: archived, merge };
    return result;
  } catch (error) {
    result.failed = errorText(error);
    return result;
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

/** What a pass did, in the sentences every host says. Nothing where
 * nothing happened. */
export function describeLandedArchive(result: LandedArchiveResult): string[] {
  const said: string[] = [];
  if (result.opened) {
    const { pullRequest, changes, merge } = result.opened;
    said.push(`opened #${pullRequest.number} to archive ${changes.join(", ")}, which landed with nothing open`);
    said.push(merge.ok
      ? `#${pullRequest.number} merges by ${merge.method} when its checks pass`
      : `#${pullRequest.number} was left open to merge by hand: ${merge.reason}`);
  }
  if (result.waitingFor && result.due.length > 0) {
    said.push(`${result.due.join(", ")} will be archived after #${result.waitingFor.number} merges`);
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
