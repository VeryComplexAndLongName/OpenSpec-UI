// Thin git wrapper — only what the UI actually needs (status, diff, commit,
// branch), not the full git API (see tasks.md 5.2). Built on top of `simple-git`.

import simpleGit, { type SimpleGit } from "simple-git";

export interface GitWrapperOptions {
  cwd: string;
}

export interface GitStatusSummary {
  current: string | null;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  notAdded: string[];
  deleted: string[];
  isClean: boolean;
}

/** One working directory of this repository, as `git worktree list`
 * reports it. The main working tree is one of these. */
export interface GitWorktree {
  /** Absolute path, as git reports it. */
  path: string;
  /** The commit it has checked out, or `undefined` for one that is bare
   * or has no checkout. */
  head?: string;
  /** The branch it is on, without the `refs/heads/` prefix, or
   * `undefined` for a detached head. */
  branch?: string;
}

/** Parses `git worktree list --porcelain`.
 *
 * The porcelain format, not the human one: the human format is column
 * aligned and puts the path first with no quoting, so a path containing
 * a space cannot be recovered from it. Porcelain gives one `key value`
 * line per fact and a blank line between entries, and the path is
 * everything after the first space. */
export function parseWorktreePorcelain(output: string): GitWorktree[] {
  const worktrees: GitWorktree[] = [];
  let current: GitWorktree | undefined;

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line.length === 0) {
      if (current) worktrees.push(current);
      current = undefined;
      continue;
    }
    const separator = line.indexOf(" ");
    const key = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1);

    if (key === "worktree") {
      if (current) worktrees.push(current);
      current = { path: value };
      continue;
    }
    if (!current) continue;
    if (key === "HEAD") current.head = value;
    // `detached` carries no value and leaves `branch` absent, which is
    // exactly what a detached head means here.
    if (key === "branch") current.branch = value.replace(/^refs\/heads\//, "");
  }
  if (current) worktrees.push(current);
  return worktrees;
}

export interface GitWrapper {
  status(): Promise<GitStatusSummary>;
  diff(pathspec?: string): Promise<string>;
  commit(message: string): Promise<{ commit: string }>;
  /** Takes the remote and branch explicitly: the git stage checks an
   * invocation against its allowlist and audits it before calling this,
   * and the command that runs has to be the command that was checked. A
   * bare `git push` resolves both from the branch's upstream — which may
   * differ from what was checked, and does not exist at all on a branch
   * that has never been pushed. */
  push(remote: string, branch: string): Promise<void>;
  currentBranch(): Promise<string>;
  /** Every working directory of this repository, the main one included. */
  worktreeList(): Promise<GitWorktree[]>;
  /** Creates a working directory at `path`, on a new branch `branch` cut
   * from `base`. Explicit in all three, as `push` is: the command that
   * runs is the command that was decided on. */
  worktreeAdd(options: { path: string; branch: string; base: string }): Promise<void>;
  /** Relocates a working directory, keeping git's own record of it in
   * step. Moving the folder by hand would leave that record pointing at
   * nothing. */
  worktreeMove(from: string, to: string): Promise<void>;
  /** Whether a local branch of this name exists.
   *
   * Asked before creating a working directory, because removing one
   * leaves its branch behind: without this the second attempt at a
   * change fails with git's own "a branch named X already exists", which
   * says nothing about what to do next. */
  branchExists(name: string): Promise<boolean>;
  worktreeRemove(path: string): Promise<void>;
  /** The git identity configured for this working directory —
   * `user.email`, falling back to `user.name` — or `undefined` where
   * none is set.
   *
   * ATTRIBUTION, NEVER AUTHENTICATION. Anybody can set this to
   * anything; it is the same self-declared label that signs every
   * commit. Nothing may be permitted or refused on the strength of it.
   * See a-lease-says-who. */
  configuredIdentity(): Promise<string | undefined>;
  /** A remote's URL, or `undefined` where the remote does not exist.
   * Read-only, and never inferred: where a repository is hosted is the
   * only thing that decides whether a Dependabot config could mean
   * anything (ADR 0007's descendants, see
   * setup-offers-only-what-applies). */
  remoteUrl(remote: string): Promise<string | undefined>;
  /** The files `branch` has changed against `base`, as repository-
   * relative paths. Three dots: what the branch changed since they
   * diverged, not everything that has happened on `base` since — the
   * second would report a collision with every change that landed while
   * this one was open. */
  changedFilesBetween(base: string, branch: string): Promise<string[]>;
  /** Whether `ref` contains `pathInRepo`. Used before creating a working
   * directory: `git worktree add` checks out a commit, so a change that
   * is not in that commit would produce a directory without the change it
   * was created for. */
  pathExistsInRef(ref: string, pathInRepo: string): Promise<boolean>;
}

export function createGitWrapper(options: GitWrapperOptions): GitWrapper {
  const git: SimpleGit = simpleGit(options.cwd);

  return {
    async status(): Promise<GitStatusSummary> {
      const s = await git.status();
      return {
        current: s.current,
        ahead: s.ahead,
        behind: s.behind,
        staged: s.staged,
        modified: s.modified,
        notAdded: s.not_added,
        deleted: s.deleted,
        isClean: s.isClean(),
      };
    },
    async diff(pathspec?: string): Promise<string> {
      return pathspec ? git.diff([pathspec]) : git.diff();
    },
    async commit(message: string): Promise<{ commit: string }> {
      const result = await git.commit(message);
      return { commit: result.commit };
    },
    async push(remote: string, branch: string): Promise<void> {
      // No extra flags: `buildGitPushInvocation` renders exactly
      // `git push <remote> <branch>`, and that argv is what the git
      // stage's allowlist checked and its audit recorded.
      await git.push(remote, branch);
    },
    async currentBranch(): Promise<string> {
      const s = await git.status();
      return s.current ?? "";
    },
    async worktreeList(): Promise<GitWorktree[]> {
      return parseWorktreePorcelain(await git.raw(["worktree", "list", "--porcelain"]));
    },
    async worktreeAdd(options: { path: string; branch: string; base: string }): Promise<void> {
      await git.raw(["worktree", "add", "-b", options.branch, options.path, options.base]);
    },
    async worktreeMove(from: string, to: string): Promise<void> {
      // No `--force` here either. Git refuses a move it cannot make
      // cleanly, and a directory relocated over the top of something
      // else would be a worse outcome than a refusal.
      await git.raw(["worktree", "move", from, to]);
    },
    async branchExists(name: string): Promise<boolean> {
      try {
        // The OUTPUT decides, not whether this threw. `--quiet` makes
        // git print nothing and exit 1 for a ref that is not there, and
        // an exit code alone is not an error the client rejects on — so
        // a version of this that only caught would have answered "yes"
        // to every branch, which reads exactly like a working check.
        const out = await git.raw(["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]);
        return out.trim().length > 0;
      } catch {
        // No such ref, or not a repository. Both mean there is no branch
        // in the way, and the caller's next check meets the second case
        // on its own terms.
        return false;
      }
    },
    async worktreeRemove(worktreePath: string): Promise<void> {
      // No `--force`. Refusing a directory that still holds work is the
      // point, and `git worktree remove --force` is right there for
      // somebody who means it.
      await git.raw(["worktree", "remove", worktreePath]);
    },
    async configuredIdentity(): Promise<string | undefined> {
      for (const key of ["user.email", "user.name"]) {
        try {
          const value = (await git.raw(["config", "--get", key])).trim();
          if (value.length > 0) return value;
        } catch {
          // Unset, or no git at all. Both mean there is no identity to
          // record — never a guess.
        }
      }
      return undefined;
    },
    async remoteUrl(remote: string): Promise<string | undefined> {
      try {
        const out = await git.raw(["remote", "get-url", remote]);
        const trimmed = out.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      } catch {
        // No such remote, or not a repository. Both mean the caller
        // could not establish where this is hosted, which is not the
        // same as establishing that it is nowhere.
        return undefined;
      }
    },
    async changedFilesBetween(base: string, branch: string): Promise<string[]> {
      const out = await git.raw(["diff", "--name-only", `${base}...${branch}`]);
      return out.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    },
    async pathExistsInRef(ref: string, pathInRepo: string): Promise<boolean> {
      try {
        // `--` separates the path from anything git could read as a
        // revision, so a change named like a ref cannot be resolved as
        // one.
        await git.raw(["cat-file", "-e", `${ref}:${pathInRepo}`]);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** The git identity to record on a workspace lease, or `undefined`.
 *
 * ATTRIBUTION, NEVER AUTHENTICATION (a-lease-says-who). Its one caller
 * shape is: read this once where a host starts up, and hand the result
 * to `WorkspaceLeaseManager`. Never call it from a heartbeat — the value
 * cannot change during a run, and the heartbeat runs every five
 * seconds. */
export async function readGitAuthor(cwd: string): Promise<string | undefined> {
  return await createGitWrapper({ cwd }).configuredIdentity();
}
