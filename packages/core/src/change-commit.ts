// A change committed and pushed where it is made
// (a-change-is-committed-where-it-is-made, ADR 0043 amended 2026-10-10).
//
// A change is made in a worktree of its own, on a branch named after it.
// Until that branch holds the change and the server has it, the change is
// files in one directory of one machine: no other directory, host or person
// sees it, and nothing can be done to it from its card. Agents were told
// where to commit and never when, and four changes of one repository sat
// uncommitted in their worktrees with their branches where main was.
//
// These functions commit what a change's worktree holds and push its
// branch: once the change is made, from its card, and before the git
// stage pushes. Never on the default branch, and never in the main
// checkout. What they say is said from the register (ADR 0046).

import { openGit } from "./git-client.js";
import { changeOfWorktree } from "./change-worktrees.js";
import { isValidChangeName } from "./change-name.js";
import { createGitWrapper, type GitWrapper } from "./git.js";
import { say, type SaidMessage } from "./message-register.js";

const DEFAULT_BRANCHES = new Set(["main", "master"]);

function gitMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).trim();
}

/** Commits everything a directory holds that is not committed, with this
 * message. The commit, or `undefined` where there was nothing to commit. */
export async function commitWhatIsLeft(directory: string, message: string): Promise<string | undefined> {
  const git = openGit(directory);
  await git.raw(["add", "--all"]);
  if ((await git.raw(["status", "--porcelain"])).trim().length === 0) return undefined;
  await git.raw(["commit", "-m", message]);
  return (await git.raw(["rev-parse", "HEAD"])).trim();
}

export interface SharedChange {
  ok: true;
  /** Where the branch was pushed: `<remote>/<branch>`. */
  pushedTo: string;
  /** The commit made, where there was something to commit. */
  commit?: string;
}

export type ShareRefusalKind = "not-a-change" | "no-worktree" | "default-branch" | "commit-failed" | "push-rejected";

export interface ShareRefusal {
  ok: false;
  kind: ShareRefusalKind;
  /** What is said of it, from the register. */
  said: SaidMessage;
  /** The commit made before the push was refused, which stays. */
  commit?: string;
}

function refused(kind: ShareRefusalKind, said: SaidMessage, commit?: string): ShareRefusal {
  return { ok: false, kind, said, ...(commit !== undefined ? { commit } : {}) };
}

/** Commits what the directory holds and pushes its branch, setting the
 * branch's upstream where it has none. Refuses the default branch. */
export async function commitAndPushDirectory(options: {
  changeName: string;
  directory: string;
  branch: string;
  message: string;
}): Promise<SharedChange | ShareRefusal> {
  const { changeName, directory, branch } = options;
  if (DEFAULT_BRANCHES.has(branch)) return refused("default-branch", say("OSW-GIT-002", { name: changeName, branch }));
  let commit: string | undefined;
  try {
    commit = await commitWhatIsLeft(directory, options.message);
  } catch (error) {
    return refused("commit-failed", say("OSW-GIT-101", { name: changeName, why: gitMessage(error) }));
  }
  const upstreams = await createGitWrapper({ cwd: directory }).branchUpstreams().catch(() => []);
  const upstream = upstreams.find((entry) => entry.branch === branch)?.upstream;
  const remote = upstream !== undefined && upstream.includes("/") ? upstream.slice(0, upstream.indexOf("/")) : "origin";
  try {
    await openGit(directory).raw(upstream !== undefined ? ["push", remote, branch] : ["push", "-u", remote, branch]);
  } catch (error) {
    const after = commit !== undefined ? ` after committing ${commit.slice(0, 8)}` : "";
    return refused("push-rejected", say("OSW-GIT-102", { branch, after, why: gitMessage(error) }), commit);
  }
  return { ok: true, pushedTo: `${remote}/${branch}`, ...(commit !== undefined ? { commit } : {}) };
}

/** What a host says of Commit Change's result, in both hosts alike. */
export function sayCommitChange(changeName: string, result: SharedChange | ShareRefusal): SaidMessage {
  if (!result.ok) return result.said;
  return result.commit !== undefined
    ? say("OSW-GIT-201", { name: changeName, commit: result.commit.slice(0, 8), pushedTo: result.pushedTo })
    : say("OSW-GIT-202", { name: changeName, pushedTo: result.pushedTo });
}

/** What a host says where a new change was made but its push refused, or
 * `undefined` where the change is on the server. */
export function sayChangeNotShared(changeName: string, directory: string, shared: SharedChange | ShareRefusal | undefined): SaidMessage | undefined {
  return shared === undefined || shared.ok ? undefined : say("OSW-GIT-203", { name: changeName, directory, why: shared.said.text });
}

export interface CommitChangeOptions {
  repositoryRoot: string;
  changeName: string;
  /** Test seam; production lists the repository's worktrees. */
  git?: Pick<GitWrapper, "worktreeList">;
}

/** Commits everything in a change's own worktree and pushes its branch:
 * Commit Change, on its card and in Show Actions... */
export async function commitChange(options: CommitChangeOptions): Promise<SharedChange | ShareRefusal> {
  const { changeName } = options;
  if (!isValidChangeName(changeName)) return refused("not-a-change", say("OSW-CHG-001", { name: changeName }));
  let worktrees;
  try {
    worktrees = await (options.git ?? createGitWrapper({ cwd: options.repositoryRoot })).worktreeList();
  } catch {
    return refused("no-worktree", say("OSW-GIT-001", { name: changeName, why: "this is not a git repository git can list" }));
  }
  const own = worktrees.find((worktree, index) => changeOfWorktree(worktree, index === 0) === changeName);
  if (own === undefined || own.branch === undefined) {
    return refused("no-worktree", say("OSW-GIT-001", { name: changeName, why: "a change worked in this checkout is committed on its own branch, never on the default one" }));
  }
  if (own.branch === worktrees[0]?.branch) return refused("default-branch", say("OSW-GIT-002", { name: changeName, branch: own.branch }));
  return commitAndPushDirectory({ changeName, directory: own.path, branch: own.branch, message: `${changeName}: commit what its worktree holds` });
}
