// Giving a change its own working directory of the repository — ADR
// 0022.
//
// The isolation ADR 0010 decision 2 named as its own precondition: a
// second working directory, on its own branch, with its own files and
// its own `.openspec-ui/`. Two chains in two of them contend for
// nothing, so the lease is unchanged and simply becomes what it always
// described — a guard on one working directory rather than a queue for
// the repository.
//
// The git facts are turned into product ones here rather than in the
// CLI: which working directory belongs to which change, which of those
// changes are still active, and where a new one would go. Both
// interactive hosts will want the same list.

import path from "node:path";
import { access } from "node:fs/promises";
import { isValidChangeName } from "./change-name.js";
import type { GitWorktree, GitWrapper } from "./git.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";
import { resolveWorktreeRoot, worktreePathUnder, type WorktreeRootSources } from "./worktree-root.js";

/** One working directory, said in this product's terms. */
export interface ChangeWorktree extends GitWorktree {
  /** The change this directory is for, taken from its branch name.
   * Absent for the main working tree and for any branch that is not a
   * change name. */
  changeName?: string;
  /** Whether that change is still an active change of the repository.
   * `false` marks a directory that has outlived what it was made for —
   * the litter a listing exists to surface. */
  changeIsActive?: boolean;
  /** Whether this is the repository's main working tree. */
  isMain: boolean;
  /** Where it would go under today's root, present only when that is
   * somewhere other than where it is.
   *
   * Reported and never acted on: somebody may have scripts pointing at
   * the path it has, and a directory that moved on its own would break
   * them for a reason nobody could see (ADR 0027). */
  belongsUnderRoot?: string;
}

/** Why a working directory will not be created. `remedy` is the point of
 * this being a structure: a refusal a reader can act on says what to do
 * next, not only what went wrong. */
export interface ChangeWorktreeRefusal {
  reason: string;
  remedy: string;
}

export type ChangeWorktreePlan =
  | { ok: true; path: string; branch: string; base: string }
  | { ok: false; refusal: ChangeWorktreeRefusal };

/** Where a working directory for `changeName` goes by default: under the
 * one root, at `<root>/<repository>/<change>`, and never inside the
 * repository itself.
 *
 * A worktree nested in its own main working tree does work, but it puts
 * a complete second copy of the repository under a directory that every
 * recursive tool in the repository will walk.
 *
 * One root for every repository rather than one container beside each:
 * see ADR 0027. The root itself is a setting of the machine, resolved by
 * `resolveWorktreeRoot`. */
export async function defaultWorktreePath(
  repositoryRoot: string,
  changeName: string,
  sources?: WorktreeRootSources,
): Promise<string> {
  const { root } = await resolveWorktreeRoot(repositoryRoot, sources ?? {});
  return worktreePathUnder(root, repositoryRoot, changeName);
}

/** The change directory's path inside the repository, as git spells it —
 * forward slashes, whatever the platform. */
function changePathInRepo(changeName: string): string {
  return `openspec/changes/${changeName}`;
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

/** Resolves everything that must hold before a working directory is
 * created, and returns either what to create or the one reason not to.
 *
 * Nothing is created by this function, and nothing existing is touched.
 * Each refusal is checked before the one after it, cheapest first. */
export async function planChangeWorktree(options: {
  git: GitWrapper;
  repositoryRoot: string;
  changeName: string;
  /** Defaults to `defaultWorktreePath`. */
  path?: string;
  /** The ref the directory is cut from. Defaults to `main`. */
  base?: string;
  /** Test seam for where the root is read from. Production passes
   * nothing and gets the real environment and the real home directory. */
  rootSources?: WorktreeRootSources;
}): Promise<ChangeWorktreePlan> {
  const { git, repositoryRoot, changeName } = options;
  const base = options.base ?? "main";
  const target = options.path
    ? path.resolve(options.path)
    : await defaultWorktreePath(repositoryRoot, changeName, options.rootSources);

  if (!isValidChangeName(changeName)) {
    return {
      ok: false,
      refusal: {
        reason: `"${changeName}" is not a valid change name`,
        remedy: "name the change as it is named in openspec/changes",
      },
    };
  }

  // `git worktree add` checks out a commit. A change that exists only as
  // uncommitted files in the main working tree is not in that commit, so
  // the directory would be created without the change it was created
  // for — successful and completely useless.
  if (!(await git.pathExistsInRef(base, changePathInRepo(changeName)))) {
    return {
      ok: false,
      refusal: {
        reason: `"${changeName}" is not in ${base}`,
        remedy: `commit ${changePathInRepo(changeName)} to ${base} first, or pass a base that has it`,
      },
    };
  }

  const worktrees = await git.worktreeList();
  const onBranch = worktrees.find((worktree) => worktree.branch === changeName);
  if (onBranch) {
    return {
      ok: false,
      refusal: {
        reason: `branch "${changeName}" is already checked out at ${onBranch.path}`,
        remedy: "run the chain in that directory, or remove it first",
      },
    };
  }

  if (await exists(target)) {
    return {
      ok: false,
      refusal: {
        reason: `${target} already exists`,
        remedy: "remove it, or pass another path",
      },
    };
  }

  return { ok: true, path: target, branch: changeName, base };
}

/** Every working directory of the repository, with the change each one
 * belongs to and whether that change is still active.
 *
 * The active-change list is read from the repository's main working
 * tree, which is the one that holds the branch every worktree was cut
 * from — a worktree's own `openspec/changes` is a snapshot of when it
 * was created, and would report its own change as active forever. */
export async function listChangeWorktrees(options: {
  git: GitWrapper;
  repositoryRoot: string;
  /** Test seam for where the root is read from. */
  rootSources?: WorktreeRootSources;
}): Promise<ChangeWorktree[]> {
  const worktrees = await options.git.worktreeList();
  const mainPath = worktrees[0]?.path;
  const { root } = await resolveWorktreeRoot(mainPath ?? options.repositoryRoot, options.rootSources ?? {});

  let activeChanges = new Set<string>();
  try {
    const workspace = await discoverOpenSpecWorkspace(mainPath ?? options.repositoryRoot);
    activeChanges = new Set(workspace.changes.map((change: { name: string }) => change.name));
  } catch {
    // A listing that cannot read the active changes still lists the
    // directories, which is most of what it is for. Marking every change
    // inactive on a read failure would be worse than marking none.
    activeChanges = new Set();
  }

  return worktrees.map((worktree, index) => {
    const isMain = index === 0;
    const changeName = !isMain && worktree.branch && isValidChangeName(worktree.branch)
      ? worktree.branch
      : undefined;
    // Only for a directory that belongs to a change: the main working
    // tree is wherever the person put the repository, and has no place
    // it ought to be instead.
    const belongsUnder = changeName !== undefined && !isMain
      ? worktreePathUnder(root, mainPath ?? options.repositoryRoot, changeName)
      : undefined;
    return {
      ...worktree,
      isMain,
      ...(changeName !== undefined
        ? { changeName, changeIsActive: activeChanges.has(changeName) }
        : {}),
      ...(belongsUnder !== undefined && path.resolve(worktree.path) !== belongsUnder
        ? { belongsUnderRoot: belongsUnder }
        : {}),
    };
  });
}
