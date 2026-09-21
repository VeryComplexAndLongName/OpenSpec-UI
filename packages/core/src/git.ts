// Thin git wrapper — only what the UI actually needs (status, diff, commit,
// branch), not the full git API (see tasks.md 5.2). Built on top of `simple-git`.

import { stat } from "node:fs/promises";
import path from "node:path";
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
/** The field separator for a `for-each-ref` format: a unit separator,
 * which no ref name contains. Written by code so that no editor or
 * heredoc can turn it into the two characters that spell it. */
const FIELD = String.fromCharCode(31);

/** A local branch and what it tracks
 * (git-says-a-working-directory-is-done). */
export interface BranchUpstream {
  branch: string;
  /** Absent where the branch tracks nothing, which means it was never
   * pushed. */
  upstream?: string;
  /** The branch records an upstream and the server no longer has it. */
  gone: boolean;
}

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
  worktreeRemove(path: string, options?: { force?: boolean }): Promise<void>;
  /** Stages everything under one path, deletions included. */
  stagePath(pathInRepo: string): Promise<void>;
  /** Deletes a local branch that is checked out nowhere. `-D`: the one
   * caller pushed it first, and a squash merge never makes it "merged". */
  deleteBranch(name: string): Promise<void>;
  /** Every local branch with the upstream it tracks and whether that
   * upstream is gone.
   *
   * `gone` is what git says about a branch that was pushed and whose
   * remote branch has since been deleted - what a merged pull request
   * leaves behind where the server deletes its branches on merge. One
   * call answers for every branch, and it touches no network
   * (git-says-a-working-directory-is-done). */
  branchUpstreams(): Promise<BranchUpstream[]>;
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
  /** The names directly under `pathInRepo` at `ref`, files and directories
   * alike. A path the ref does not have lists as empty; a ref that does not
   * exist rejects (a-change-says-where-it-stands). */
  listTreeNames(ref: string, pathInRepo: string): Promise<string[]>;
  /** A file's text at `ref`, or `undefined` where the ref or the path is not
   * there. */
  showFile(ref: string, pathInRepo: string): Promise<string | undefined>;
  /** Whether `ref` names a commit. */
  refExists(ref: string): Promise<boolean>;
  /** Every ref under the given prefixes, by full name with the commit it
   * points at, in one call. */
  listRefs(prefixes: readonly string[]): Promise<Array<{ name: string; commit: string }>>;
  /** The commit `ref` names, or `undefined` where it names none. */
  resolveCommit(ref: string): Promise<string | undefined>;
  /** Fetches `remote`. Touches refs only, never a working tree.
   *
   * With `prune`, drops remote-tracking refs whose branch the server no
   * longer has - which is what turns a merged branch into `gone`
   * (git-says-a-working-directory-is-done). */
  fetch(remote: string, options?: { prune?: boolean }): Promise<void>;
  /** When refs were last fetched: the modification time of `FETCH_HEAD` in
   * the repository's common git directory, or `undefined` where there has
   * been no fetch. */
  lastFetchedAt(): Promise<Date | undefined>;
  /** The merge base of two refs, or `undefined` where they share none. */
  mergeBase(left: string, right: string): Promise<string | undefined>;
  /** How many commits each of two refs has that the other does not.
   *
   * One `rev-list --left-right --count`, which answers both directions at
   * once. Both are read because `behind` is what a person is told and
   * `ahead` is what makes a fast-forward impossible: a refusal that
   * cannot say why is worse than none (main-catches-up-with-what-landed).
   *
   * `undefined` where either ref does not resolve. */
  aheadBehind(left: string, right: string): Promise<{ ahead: number; behind: number } | undefined>;
  /** Moves the current branch to `ref` where that is a fast-forward, and
   * refuses otherwise. Runs exactly `git merge --ff-only <ref>`: it moves
   * a pointer and can conflict with nothing. */
  fastForward(ref: string): Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Rebases the checked-out branch onto `onto`. On a conflict the rebase
   * is aborted before this returns, so the branch is exactly as it was,
   * and the files in conflict are named (ADR 0034). */
  rebaseOnto(onto: string): Promise<{ ok: true } | { ok: false; conflicts: string[]; reason: string }>;
  /** Pushes `branch` over its remote copy only while that copy is still
   * at `expected`. A push somebody else made in the meantime refuses
   * this one rather than being overwritten (ADR 0034). */
  pushWithLease(remote: string, branch: string, expected: string): Promise<void>;
  /** Puts the checked-out branch back at `commit`, discarding what moved
   * it since. Used only to undo a rebase whose push was refused, on a tree
   * that was clean before it, so nothing uncommitted can be lost
   * (ADR 0034). */
  restoreTo(commit: string): Promise<void>;
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
    async worktreeRemove(worktreePath: string, options: { force?: boolean } = {}): Promise<void> {
      // No `--force` by default. Refusing a directory that still holds
      // work is the point. The sweep passes it, having read the tree as
      // clean itself, because a directory holding only ignored files -
      // a module overlay, a downloaded editor - is refused otherwise
      // (git-says-a-working-directory-is-done).
      const force = options.force === true ? ["--force"] : [];
      await git.raw(["worktree", "remove", ...force, worktreePath]);
    },
    async stagePath(pathInRepo: string): Promise<void> {
      await git.raw(["add", "--all", "--", pathInRepo]);
    },
    async deleteBranch(name: string): Promise<void> {
      await git.raw(["branch", "-D", name]);
    },
    async branchUpstreams(): Promise<BranchUpstream[]> {
      const out = await git.raw([
        "for-each-ref",
        "--format=%(refname:short)" + FIELD + "%(upstream:short)" + FIELD + "%(upstream:track)",
        "refs/heads",
      ]);
      // Lines split on a newline built from its code point, and the
      // carriage return trimmed: an escape sequence written here is
      // liable to become the character it names before it reaches the
      // file (feedback_heredoc_destroys_escape_sequences).
      return out
        .split(String.fromCharCode(10))
        .map((line) => line.trim())
        .map((line) => line.split(FIELD))
        .filter((parts) => (parts[0] ?? "").length > 0)
        .map(([branch, upstream, track]) => ({
          branch: branch as string,
          ...((upstream ?? "").length > 0 ? { upstream: upstream as string } : {}),
          // git writes "[gone]" among the tracking counts.
          gone: (track ?? "").includes("gone"),
        }));
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
    async listTreeNames(ref: string, pathInRepo: string): Promise<string[]> {
      const tree = pathInRepo.replace(/\/+$/u, "");
      try {
        const out = await git.raw(["ls-tree", "--name-only", `${ref}:${tree}`]);
        return out.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
      } catch (error) {
        // `<ref>:<path>` fails alike for a missing ref and a missing path.
        // Only the second is an answer.
        if (await this.refExists(ref)) return [];
        throw error;
      }
    },
    async showFile(ref: string, pathInRepo: string): Promise<string | undefined> {
      try {
        return await git.raw(["show", `${ref}:${pathInRepo}`]);
      } catch {
        return undefined;
      }
    },
    async refExists(ref: string): Promise<boolean> {
      try {
        const out = await git.raw(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
        return out.trim().length > 0;
      } catch {
        return false;
      }
    },
    async listRefs(prefixes: readonly string[]): Promise<Array<{ name: string; commit: string }>> {
      const out = await git.raw(["for-each-ref", "--format=%(objectname) %(refname)", ...prefixes]);
      return out
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const separator = line.indexOf(" ");
          return { commit: line.slice(0, separator), name: line.slice(separator + 1) };
        });
    },
    async resolveCommit(ref: string): Promise<string | undefined> {
      try {
        const out = (await git.raw(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])).trim();
        return out.length > 0 ? out : undefined;
      } catch {
        return undefined;
      }
    },
    async fetch(remote: string, options: { prune?: boolean } = {}): Promise<void> {
      const prune = options.prune === true ? ["--prune"] : [];
      await git.raw(["fetch", "--quiet", ...prune, remote]);
    },
    async lastFetchedAt(): Promise<Date | undefined> {
      try {
        const common = (await git.raw(["rev-parse", "--git-common-dir"])).trim();
        const info = await stat(path.join(path.resolve(options.cwd, common), "FETCH_HEAD"));
        return info.mtime;
      } catch {
        return undefined;
      }
    },
    async mergeBase(left: string, right: string): Promise<string | undefined> {
      try {
        const out = (await git.raw(["merge-base", left, right])).trim();
        return out.length > 0 ? out : undefined;
      } catch {
        return undefined;
      }
    },
    async aheadBehind(left: string, right: string): Promise<{ ahead: number; behind: number } | undefined> {
      try {
        // `A...B` with `--left-right` counts each side's own commits: the
        // left column is what A has and B does not.
        const out = (await git.raw(["rev-list", "--left-right", "--count", `${left}...${right}`])).trim();
        const [ahead, behind] = out.split(/\s+/u).map((part) => Number.parseInt(part, 10));
        if (!Number.isFinite(ahead) || !Number.isFinite(behind)) return undefined;
        return { ahead: ahead as number, behind: behind as number };
      } catch {
        return undefined;
      }
    },
    async fastForward(ref: string): Promise<{ ok: true } | { ok: false; reason: string }> {
      try {
        await git.raw(["merge", "--ff-only", ref]);
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message.trim() : String(error) };
      }
    },
    async rebaseOnto(onto: string): Promise<{ ok: true } | { ok: false; conflicts: string[]; reason: string }> {
      try {
        await git.raw(["rebase", onto]);
        return { ok: true };
      } catch (error) {
        const reason = error instanceof Error ? error.message.trim() : String(error);
        // What conflicts, read before the abort puts the tree back.
        let conflicts: string[] = [];
        try {
          const out = await git.raw(["diff", "--name-only", "--diff-filter=U"]);
          conflicts = out.split(String.fromCharCode(10)).map((line) => line.trim()).filter((line) => line.length > 0);
        } catch {
          conflicts = [];
        }
        // Never left half-way: a sweep that stops mid-rebase leaves a
        // working directory nobody can use until somebody notices.
        try {
          await git.raw(["rebase", "--abort"]);
        } catch {
          // Nothing was started, so there is nothing to abort.
        }
        return { ok: false, conflicts, reason };
      }
    },
    async pushWithLease(remote: string, branch: string, expected: string): Promise<void> {
      await git.raw(["push", `--force-with-lease=${branch}:${expected}`, remote, branch]);
    },
    async restoreTo(commit: string): Promise<void> {
      await git.raw(["reset", "--hard", commit]);
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
