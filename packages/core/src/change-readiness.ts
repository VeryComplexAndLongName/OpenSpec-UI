// What can start now, and alongside what — ADR 0024.
//
// Two halves existed and were not joined: `change-graph.ts` reads what
// each change declares about the others, and the cross-host lease says
// which working directory is busy. Neither answers the question a
// person actually has in front of them.
//
// Nothing here is declared by a change beyond what it already declares.
// A `touches:` list of paths was rejected in ADR 0024 for one reason: it
// is written before the work by whoever knows least about it, drifts
// within a week, and a drifted declaration is worse than an absent one
// because it is believed.

import path from "node:path";
import { readChangeGraph, type ChangeGraph } from "./change-graph.js";
import { listChangeWorktrees, type ChangeWorktree } from "./change-worktrees.js";
import { createGitWrapper, type GitWrapper } from "./git.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";
import { readWorkspaceLeaseHolder, type WorkspaceLeaseConflict } from "./workspace-lease.js";

/** Why two changes cannot be started alongside each other.
 *
 * Three kinds, reported as themselves rather than merged into a score: a
 * reader acts differently on "these two edit the same file" than on
 * "these two touch the same capability", and differently again on "this
 * one declares it waits for that one". */
export type ChangeCollision =
  | { kind: "declared-blocker"; blocker: string }
  | { kind: "shared-capability"; capability: string }
  | { kind: "overlapping-files"; files: string[] };

export type ChangeRunState =
  /** A working directory of this repository is holding the workspace for
   * this change right now. */
  | { state: "running"; worktreePath: string; holder: WorkspaceLeaseConflict }
  /** Something this change declares is not satisfied yet. */
  | { state: "blocked"; blockedBy: string[] }
  | { state: "ready" };

export interface ChangeReadiness {
  changeName: string;
  run: ChangeRunState;
  /** The capabilities this change's delta carries — the spec files it
   * will merge into at archive. */
  capabilities: string[];
  /** Its own working directory, if it has one. Without one it cannot run
   * beside anything: one directory permits one mutating run. */
  worktreePath?: string;
  /** Other ready changes this one can be started alongside. */
  canJoin: string[];
  /** Other ready changes it cannot, and what they would meet over. */
  blockedFrom: Array<{ changeName: string; collisions: ChangeCollision[] }>;
  /** Present only where the change is ready but has nowhere of its own
   * to run. The remedy is one command and naming it is most of the
   * help. */
  needsWorktree?: string;
}

export interface ChangeReadinessReport {
  changes: ChangeReadiness[];
}

/** The capabilities a change's spec delta names — the directories under
 * its own `specs/`. Two changes sharing one write to the same
 * `openspec/specs/<capability>/spec.md` when they archive, which is the
 * collision that is knowable before either has been started. */
async function capabilitiesOf(workspaceRoot: string, changeName: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  try {
    const entries = await readdir(path.join(workspaceRoot, "openspec", "changes", changeName, "specs"), {
      withFileTypes: true,
    });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    // A change with no delta collides with nobody over a capability,
    // which is what an empty list already means here.
    return [];
  }
}

/** What a worktree's branch has changed against its base. Precise, and
 * available only once there is a working directory — which is why it
 * supplements the capability check rather than replacing it. */
async function changedFilesOf(
  git: GitWrapper,
  worktree: ChangeWorktree,
  base: string,
): Promise<string[]> {
  if (!worktree.branch) return [];
  try {
    return await git.changedFilesBetween(base, worktree.branch);
  } catch {
    // A branch with no merge base yet, or a git that refused: reporting
    // no overlap is the same answer as having no worktree, and is better
    // than refusing to produce the report at all.
    return [];
  }
}

function collisionsBetween(
  left: ChangeReadiness,
  right: ChangeReadiness,
  graph: ChangeGraph,
  filesByChange: Map<string, string[]>,
): ChangeCollision[] {
  const collisions: ChangeCollision[] = [];

  for (const [a, b] of [[left, right], [right, left]] as const) {
    for (const blocker of graph.get(a.changeName)?.blockedBy ?? []) {
      if (blocker === b.changeName) collisions.push({ kind: "declared-blocker", blocker });
    }
  }

  for (const capability of left.capabilities) {
    if (right.capabilities.includes(capability)) {
      collisions.push({ kind: "shared-capability", capability });
    }
  }

  const leftFiles = filesByChange.get(left.changeName) ?? [];
  const rightFiles = new Set(filesByChange.get(right.changeName) ?? []);
  const shared = leftFiles.filter((file) => rightFiles.has(file)).sort();
  if (shared.length > 0) collisions.push({ kind: "overlapping-files", files: shared });

  return collisions;
}

export interface ChangeReadinessOptions {
  workspaceRoot: string;
  /** The ref a worktree's branch is compared against. */
  base?: string;
  /** Test seam; production builds one on the repository. */
  git?: GitWrapper;
  /** Test seam for the lease's staleness window. */
  staleAfterMs?: number;
}

/** Every active change, its state, and — for the ready ones — which
 * others each can be started alongside.
 *
 * Pairwise, never as one group of changes that may run together: three
 * changes where A and B collide and C collides with neither have no
 * single correct grouping, and presenting one would choose for the
 * reader and hide that a choice existed. */
export async function readChangeReadiness(options: ChangeReadinessOptions): Promise<ChangeReadinessReport> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const base = options.base ?? "main";
  const git = options.git ?? createGitWrapper({ cwd: workspaceRoot });

  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
  const active = workspace.changes.map((change: { name: string }) => change.name).sort();
  const activeSet = new Set(active);
  const graph = await readChangeGraph(workspaceRoot);

  let worktrees: ChangeWorktree[] = [];
  try {
    worktrees = await listChangeWorktrees({ git, repositoryRoot: workspaceRoot });
  } catch {
    // Not a git repository, or git unavailable. Every change is then
    // simply one without a working directory, which is a true statement
    // and a more useful report than none.
    worktrees = [];
  }
  const worktreeByChange = new Map(
    worktrees.filter((worktree) => worktree.changeName !== undefined).map((w) => [w.changeName as string, w]),
  );

  const filesByChange = new Map<string, string[]>();
  const changes: ChangeReadiness[] = [];

  for (const changeName of active) {
    const worktree = worktreeByChange.get(changeName);
    const capabilities = await capabilitiesOf(workspaceRoot, changeName);
    if (worktree) filesByChange.set(changeName, await changedFilesOf(git, worktree, base));

    // Unmet, meaning the named change is still active. A blocker that
    // has archived is satisfied — which is what `blocked_by` has always
    // meant and what `findUnmetBlockers` already encodes.
    const unmet = (graph.get(changeName)?.blockedBy ?? []).filter((blocker) => activeSet.has(blocker));

    // Read rather than inferred, and a stale lease is nobody: the holder
    // is gone and only its file is left.
    const holder = worktree
      ? await readWorkspaceLeaseHolder(worktree.path, options.staleAfterMs !== undefined
        ? { staleAfterMs: options.staleAfterMs }
        : {})
      : undefined;

    const run: ChangeRunState = holder && worktree
      ? { state: "running", worktreePath: worktree.path, holder }
      : unmet.length > 0
        ? { state: "blocked", blockedBy: unmet }
        : { state: "ready" };

    changes.push({
      changeName,
      run,
      capabilities,
      ...(worktree ? { worktreePath: worktree.path } : {}),
      canJoin: [],
      blockedFrom: [],
      ...(run.state === "ready" && !worktree
        ? { needsWorktree: `openspec-ui-cli worktree add ${changeName}` }
        : {}),
    });
  }

  const ready = changes.filter((change) => change.run.state === "ready");
  for (const change of ready) {
    for (const other of ready) {
      if (other === change) continue;
      const collisions = collisionsBetween(change, other, graph, filesByChange);
      if (collisions.length > 0) change.blockedFrom.push({ changeName: other.changeName, collisions });
      // A change with no working directory of its own cannot run beside
      // anything at all — the lease permits one mutating run per
      // directory — so it joins nothing even where nothing collides.
      else if (change.worktreePath && other.worktreePath) change.canJoin.push(other.changeName);
    }
  }

  return { changes };
}

/** One collision in the terms a reader acts on. */
export function describeCollision(collision: ChangeCollision): string {
  switch (collision.kind) {
    case "declared-blocker":
      return `one declares it is blocked by ${collision.blocker}`;
    case "shared-capability":
      return `both deliver a delta for "${collision.capability}", which archives into one spec file`;
    case "overlapping-files":
      return collision.files.length === 1
        ? `both branches have changed ${collision.files[0]}`
        : `both branches have changed ${collision.files.length} of the same files, including ${collision.files[0]}`;
  }
}
