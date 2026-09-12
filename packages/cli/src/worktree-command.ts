// `worktree add`, `list` and `remove` — ADR 0022.
//
// Wiring and presentation only. Where a directory goes, whether it may
// be created, and which change each one belongs to are all decided in
// core (`change-worktrees.ts`); this file turns those answers into
// output and an exit code.

import path from "node:path";
import {
  createGitWrapper,
  harvestWorktree,
  listChangeWorktrees,
  planChangeWorktree,
  type GitWrapper,
  type HarvestResult,
  type WorktreeRootSources,
} from "@openspec-ui/core";

export interface WorktreeOptions {
  repositoryRoot: string;
  action: "add" | "list" | "move" | "remove";
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
  /** Test seam for where the root is read from. Without it a test reads
   * the machine's own environment and settings, and would pass or fail
   * by whoever happens to be running it. */
  rootSources?: WorktreeRootSources;
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
    if (options.action === "move") {
      return await moveWorktree({ git, repositoryRoot, changeName: options.changeName }, deps);
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
    ...(deps.rootSources ? { rootSources: deps.rootSources } : {}),
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
  const worktrees = await listChangeWorktrees({ ...context, ...(deps.rootSources ? { rootSources: deps.rootSources } : {}) });

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
    // Reported, never moved as a side effect: somebody may have scripts
    // pointing at the path it has (ADR 0027).
    if (worktree.belongsUnderRoot) {
      deps.stdout(`      not under the root — it would go at ${worktree.belongsUnderRoot}`);
      deps.stdout(`      move it with: openspec-ui-cli worktree move ${worktree.changeName ?? ""}`.trimEnd());
    }
  }
  if (worktrees.length === 0) deps.stdout("No working directories.");
  return 0;
}

/** Moves one working directory under the root, on request only.
 *
 * Never as a side effect of `list` or of anything else: a directory that
 * relocated on its own would break whatever was pointing at it, for a
 * reason nobody could see. And only directories this tool made — a
 * folder beside the repository that is not a working directory of it is
 * something whose contents are not known here (ADR 0027). */
async function moveWorktree(
  context: { git: GitWrapper; repositoryRoot: string; changeName: string },
  deps: WorktreeDeps,
): Promise<number> {
  const worktrees = await listChangeWorktrees({ ...context, ...(deps.rootSources ? { rootSources: deps.rootSources } : {}) });
  const target = worktrees.find((worktree) => worktree.changeName === context.changeName);
  if (!target) {
    deps.stderr(`openspec-ui-cli: no working directory for "${context.changeName}"`);
    return 1;
  }
  if (!target.belongsUnderRoot) {
    deps.stdout(`${target.path} is already under the root.`);
    return 0;
  }

  try {
    await context.git.worktreeMove(target.path, target.belongsUnderRoot);
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not move ${target.path}: ${message(error)}`);
    return 1;
  }
  deps.stdout(`Moved ${target.path} to ${target.belongsUnderRoot}.`);
  return 0;
}

async function removeWorktree(
  context: { git: GitWrapper; repositoryRoot: string; changeName: string },
  deps: WorktreeDeps,
): Promise<number> {
  const worktrees = await listChangeWorktrees({ ...context, ...(deps.rootSources ? { rootSources: deps.rootSources } : {}) });
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

  // Harvested BEFORE anything is deleted. The directory's `.openspec-ui/`
  // is gitignored, so its run history cannot leave by commit — and
  // removal does not see ignored files, so without this it goes with the
  // directory (ADR 0027).
  let harvest: HarvestResult;
  try {
    harvest = await harvestWorktree({ repositoryRoot: context.repositoryRoot, worktreePath: target.path });
  } catch (error) {
    // Nothing has been deleted yet, so the directory is still whole.
    // Refusing here costs a retry; removing anyway would cost the
    // history this step exists to keep.
    deps.stderr(`openspec-ui-cli: could not take the run history out of ${target.path}: ${message(error)}`);
    deps.stderr("openspec-ui-cli: nothing was removed");
    return 1;
  }

  if (harvest.entriesTaken > 0) {
    const runs = `${harvest.entriesTaken} run record${harvest.entriesTaken === 1 ? "" : "s"}`;
    deps.stdout(`Took ${runs} into this repository's own history.`);
  }
  if (harvest.failureArtifacts > 0) {
    // They exist only where something failed, which is when somebody
    // wants them.
    deps.stdout(`Took ${harvest.failureArtifacts} browser-suite failure artifact(s).`);
  }
  // Said before it happens, not after. A destroyed thing that was
  // announced is a decision; one that was not is a discovery.
  for (const leaving of harvest.discarded) deps.stdout(`Discarding ${leaving}.`);

  await context.git.worktreeRemove(target.path);
  deps.stdout(`Removed ${target.path}.`);
  return 0;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
