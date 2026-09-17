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
import { agentStatusDirectory, readAgentStatuses, type AgentStatusReport } from "./agent-status.js";
import { readChangeGraph, type ChangeGraph } from "./change-graph.js";
import { listChangeWorktrees, type ChangeWorktree } from "./change-worktrees.js";
import { createGitWrapper, type GitWrapper } from "./git.js";
import { pathKey } from "./path-key.js";
import { discoverOpenSpecWorkspace, type WorkbenchChange } from "./workbench.js";
import { readWorkspaceLeaseHolder } from "./workspace-lease.js";
import { resolveWorktreeRoot } from "./worktree-root.js";
import type { ChangeCollision, ChangeReadiness, ChangeReadinessReport, ChangeRunState } from "./change-readiness-facts.js";

// The report's shape and the words it is described in live in a leaf the
// browser can also import; this file is the part that reads a repository
// to fill it in. Re-exported so every existing importer of this module
// keeps working.
export {
  describeCollision,
  type ChangeCollision,
  type ChangeReadiness,
  type ChangeReadinessReport,
  type ChangeRunState,
} from "./change-readiness-facts.js";

/** The capabilities a change's spec delta names: the capability path of
 * each delta spec its schema finds, at any depth, such as
 * `web/dashboard-foundation` (ADR 0031). Two changes sharing one write to the
 * same `openspec/specs/<capability>/spec.md` when they archive, which is the
 * collision that is knowable before either has been started. A change with
 * no delta collides with nobody over a capability, which is what an empty
 * list already means here. */
function capabilitiesOf(change: WorkbenchChange | undefined): string[] {
  // From the reading of the workspace the report already took, which listed
  // every active change's artifacts against the same project root; listing
  // them again per change read each change's schema a second time
  // (the-pipeline-reads-each-workspace-once).
  return (change?.artifacts ?? [])
    .filter((artifact) => artifact.kind === "delta-spec" && artifact.exists)
    .map((artifact) => artifact.label)
    .sort();
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
  /** Test seam: the runs' status records, in place of reading them. */
  statuses?: AgentStatusReport[];
}

/** The runs' status records, read from the directory beside the
 * repository's working directories, located from the main working
 * directory `listChangeWorktrees` already listed — no git of its own.
 *
 * A diagnostic about runs must never make a readiness report fail: a
 * directory that cannot be read gives no records, and the report is what
 * it would have been without them. */
async function readStatuses(worktrees: readonly ChangeWorktree[], seam: AgentStatusReport[] | undefined): Promise<AgentStatusReport[]> {
  if (seam !== undefined) return seam;
  const main = worktrees.find((worktree) => worktree.isMain);
  if (main === undefined) return [];
  try {
    const { root } = await resolveWorktreeRoot(main.path, {});
    return (await readAgentStatuses(agentStatusDirectory(root, main.path))).reports;
  } catch {
    return [];
  }
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

  // Active changes only: the report is about what can run, and the archive
  // is most of a whole reading's cost.
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot, { changes: "active" });
  const byName = new Map(workspace.changes.map((change) => [change.name, change]));
  const active = [...byName.keys()].sort();
  const activeSet = new Set(active);
  // Relations among active changes only: an archived blocker is met, and no
  // collision is computed with an archived change.
  const graph = await readChangeGraph(workspaceRoot, { changes: "active" });

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
  const statuses = await readStatuses(worktrees, options.statuses);
  const workspaceKey = pathKey(workspaceRoot);

  /** The live record that says a run is on `changeName`, from this
   * checkout or from the change's own worktree. A copy of the change in
   * any other directory is a different change (ADR 0026), so a record
   * from there does not count, and the name alone is never enough. */
  const reportFor = (changeName: string, worktree: ChangeWorktree | undefined): AgentStatusReport | undefined =>
    statuses.find((report) => {
      if (report.gone || report.changeName !== changeName) return false;
      const key = pathKey(report.workingDirectory);
      return key === workspaceKey || (worktree !== undefined && key === pathKey(worktree.path));
    });

  const filesByChange = new Map<string, string[]>();
  const changes: ChangeReadiness[] = [];

  for (const changeName of active) {
    const worktree = worktreeByChange.get(changeName);
    const capabilities = capabilitiesOf(byName.get(changeName));
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
    const record = reportFor(changeName, worktree);

    let run: ChangeRunState;
    if ((holder !== undefined && worktree !== undefined) || record !== undefined) {
      // The lease says who holds the worktree; the record says a run is
      // on this change (ADR 0028). Either makes the change running, and
      // each is carried as what it is.
      run = {
        state: "running",
        worktreePath: holder !== undefined && worktree !== undefined
          ? worktree.path
          : (record as AgentStatusReport).workingDirectory,
        ...(holder !== undefined && worktree !== undefined ? { holder } : {}),
        ...(record !== undefined
          ? { reportedBy: { instanceId: record.instanceId, workingDirectory: record.workingDirectory } }
          : {}),
      };
    } else if (unmet.length > 0) {
      run = { state: "blocked", blockedBy: unmet };
    } else {
      run = { state: "ready" };
    }

    changes.push({
      changeName,
      run,
      blockers: unmet,
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
