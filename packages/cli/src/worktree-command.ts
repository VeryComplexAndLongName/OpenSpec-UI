// `worktree add`, `list` and `remove` — ADR 0022.
//
// Wiring and presentation only. Where a directory goes, whether it may
// be created, and which change each one belongs to are all decided in
// core (`change-worktrees.ts`); this file turns those answers into
// output and an exit code.

import path from "node:path";
import {
  createGitWrapper,
  listChangeWorktrees,
  planChangeWorktree,
  type GitWrapper,
} from "@openspec-ui/core";

export interface WorktreeOptions {
  repositoryRoot: string;
  action: "add" | "list" | "remove";
  changeName?: string;
  path?: string;
  base?: string;
  format: "text" | "json";
}

export interface WorktreeDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seam. Production builds the real wrapper on the repository. */
  createGit?: (cwd: string) => GitWrapper;
}

/** `0` done, `1` refused, `2` the command could not run at all. A
 * refusal here is a `1` rather than the `2` a refused `run` gets: `run`
 * declines to start work, while this is being told the thing asked for
 * cannot be — a branch already taken, a change not committed. */
export async function worktreeCommand(options: WorktreeOptions, deps: WorktreeDeps): Promise<number> {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const git = (deps.createGit ?? ((cwd: string) => createGitWrapper({ cwd })))(repositoryRoot);

  try {
    if (options.action === "list") return await listWorktrees({ git, repositoryRoot }, options, deps);
    if (!options.changeName) {
      deps.stderr(`openspec-ui-cli: worktree ${options.action} requires a change name`);
      return 2;
    }
    if (options.action === "add") {
      return await addWorktree({ git, repositoryRoot, changeName: options.changeName }, options, deps);
    }
    return await removeWorktree({ git, repositoryRoot, changeName: options.changeName }, deps);
  } catch (error) {
    deps.stderr(`openspec-ui-cli: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

async function addWorktree(
  context: { git: GitWrapper; repositoryRoot: string; changeName: string },
  options: WorktreeOptions,
  deps: WorktreeDeps,
): Promise<number> {
  const plan = await planChangeWorktree({
    git: context.git,
    repositoryRoot: context.repositoryRoot,
    changeName: context.changeName,
    ...(options.path !== undefined ? { path: options.path } : {}),
    ...(options.base !== undefined ? { base: options.base } : {}),
  });

  if (!plan.ok) {
    deps.stderr(`openspec-ui-cli: will not create a working directory for "${context.changeName}": ${plan.refusal.reason}`);
    deps.stderr(`openspec-ui-cli: ${plan.refusal.remedy}`);
    return 1;
  }

  await context.git.worktreeAdd({ path: plan.path, branch: plan.branch, base: plan.base });

  if (options.format === "json") {
    deps.stdout(JSON.stringify({ path: plan.path, branch: plan.branch, base: plan.base }, null, 2));
    return 0;
  }
  deps.stdout(`Created ${plan.path} on branch "${plan.branch}", cut from ${plan.base}.`);
  // The path is long and starting the chain is the next thing to happen.
  deps.stdout("");
  deps.stdout(`  openspec-ui-cli run ${context.changeName} --cwd "${plan.path}"`);
  return 0;
}

async function listWorktrees(
  context: { git: GitWrapper; repositoryRoot: string },
  options: WorktreeOptions,
  deps: WorktreeDeps,
): Promise<number> {
  const worktrees = await listChangeWorktrees(context);

  if (options.format === "json") {
    deps.stdout(JSON.stringify(worktrees, null, 2));
    return 0;
  }

  for (const worktree of worktrees) {
    const branch = worktree.branch ? ` [${worktree.branch}]` : " [detached]";
    const role = worktree.isMain
      ? "  (main)"
      : worktree.changeName === undefined
        ? ""
        // A working directory that has outlived the change it was made
        // for is the litter this listing exists to surface.
        : worktree.changeIsActive ? "" : "  — its change is no longer active";
    deps.stdout(`${worktree.path}${branch}${role}`);
  }
  if (worktrees.length === 0) deps.stdout("No working directories.");
  return 0;
}

async function removeWorktree(
  context: { git: GitWrapper; repositoryRoot: string; changeName: string },
  deps: WorktreeDeps,
): Promise<number> {
  const worktrees = await listChangeWorktrees(context);
  const target = worktrees.find((worktree) => worktree.changeName === context.changeName);
  if (!target) {
    deps.stderr(`openspec-ui-cli: no working directory for "${context.changeName}"`);
    return 1;
  }

  // Refused rather than forced: the whole point of the branch is that the
  // work in it is not lost. `git worktree remove --force` is right there
  // for somebody who means it, and says plainly what it does.
  const status = await (deps.createGit ?? ((cwd: string) => createGitWrapper({ cwd })))(target.path).status();
  if (!status.isClean) {
    deps.stderr(`openspec-ui-cli: ${target.path} still holds uncommitted work`);
    deps.stderr("openspec-ui-cli: commit it, or remove the directory with \"git worktree remove --force\"");
    return 1;
  }

  await context.git.worktreeRemove(target.path);
  deps.stdout(`Removed ${target.path}.`);
  return 0;
}
