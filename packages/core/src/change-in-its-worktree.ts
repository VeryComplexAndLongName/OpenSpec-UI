// A new change is made in a working directory of its own
// (agents-are-told-how-work-is-done-here, ADR 0043).
//
// Until now "Create OpenSpec Change" wrote the change into the checkout
// the host had open, on whatever branch it had checked out, and a working
// directory could be made for it only once it was committed there
// (ADR 0022 decision 3). The rule the agents are now told is the other way
// round, and the product keeps it too: the directory first, cut from the
// default branch as the server has it, and the change made inside it.

import { createGitWrapper, type GitWrapper } from "./git.js";
import { planChangeWorktree } from "./change-worktrees.js";
import { DEFAULT_BRANCH, DEFAULT_REMOTE } from "./main-drift-facts.js";
import { createChange, type CreateChangeOptions } from "./openspec.js";
import type { WorktreeRootSources } from "./worktree-root.js";

export interface ChangeMade {
  /** Where the change's files are: its own working directory, or the
   * repository itself where it has no remote to cut one from. */
  directory: string;
  /** The branch it is on, where it has a directory of its own. */
  branch?: string;
}

/** Makes `changeName` in a working directory of its own, on a branch of
 * the same name cut from `origin/main` after a fetch. A repository with no
 * `origin` has no default branch on a server to cut from, and the change
 * is made where it always was.
 *
 * Refuses, making nothing, where `planChangeWorktree` refuses: a change of
 * that name already in the checkout, a branch or directory of that name
 * already there. */
export async function createChangeInItsWorktree(options: {
  repositoryRoot: string;
  changeName: string;
  createOptions?: CreateChangeOptions;
  /** Test seams. */
  git?: GitWrapper;
  rootSources?: WorktreeRootSources;
  create?: typeof createChange;
}): Promise<ChangeMade> {
  const git = options.git ?? createGitWrapper({ cwd: options.repositoryRoot });
  const create = options.create ?? createChange;
  if (await git.remoteUrl(DEFAULT_REMOTE) === undefined) {
    await create(options.changeName, { cwd: options.repositoryRoot }, options.createOptions);
    return { directory: options.repositoryRoot };
  }
  // A failed fetch still leaves the default branch as it was last read,
  // which is a sound base; it is only older.
  await git.fetch(DEFAULT_REMOTE).catch(() => undefined);
  const plan = await planChangeWorktree({
    git,
    repositoryRoot: options.repositoryRoot,
    changeName: options.changeName,
    base: `${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`,
    ...(options.rootSources ? { rootSources: options.rootSources } : {}),
  });
  if (!plan.ok) throw new Error(`${plan.refusal.reason}; ${plan.refusal.remedy}`);
  await git.worktreeAdd({ path: plan.path, branch: plan.branch, base: plan.base });
  await create(options.changeName, { cwd: plan.path }, options.createOptions);
  return { directory: plan.path, branch: plan.branch };
}
