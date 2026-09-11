// One repository, one spending ceiling — ADR 0022 decision 5.
//
// `FileAuditLog` writes `<root>/.openspec-ui/audit.jsonl`, and the
// chain's budget check reads it back to sum what a change has already
// spent. Give each worktree its own root and each run sees only itself,
// so `budget.maxCostUsd` becomes a per-worktree allowance: three
// worktrees, three times the ceiling, silently.
//
// The aggregation is on the READ side, deliberately. Each working
// directory keeps writing its own file — one writer per file, no
// locking, nothing changed about how a run records itself. Pointing
// every worktree's writer at one shared file would put several processes
// on `FileAuditLog`'s append-and-rotate path, and rotation rewrites the
// whole file: two rotations interleaving lose entries. A read that
// aggregates cannot lose anything; a write that aggregates can.

import path from "node:path";
import type { GitWrapper } from "./git.js";
import { FileAuditLog, auditLogPath, type AuditEntry } from "./security.js";

/** Reads the recorded entries of every working directory of this
 * repository, oldest first within each.
 *
 * A log that cannot be read is skipped rather than failing the sum. A
 * sibling worktree that was removed, or belongs to another user, must
 * not stop this run from starting — and an absent log already means "no
 * recorded usage" rather than an error, which is the behaviour this
 * extends rather than invents.
 *
 * Falls back to the given root alone when the worktree list cannot be
 * read at all: a directory that is not a git repository still has its
 * own log, and that is exactly what was summed before this existed. */
export async function readRepositoryAuditEntries(options: {
  git: GitWrapper;
  workspaceRoot: string;
}): Promise<AuditEntry[]> {
  const roots = await repositoryWorkspaceRoots(options);
  const entries: AuditEntry[] = [];

  for (const root of roots) {
    try {
      entries.push(...await new FileAuditLog(auditLogPath(root)).readEntries());
    } catch {
      // Skipped, per this module's header: one unreadable sibling is not
      // a reason to refuse to start.
    }
  }
  return entries;
}

/** Every working directory of the repository, as absolute paths, with
 * the given root included exactly once even when git does not list it
 * (a plain directory, a repository this root is not actually inside). */
export async function repositoryWorkspaceRoots(options: {
  git: GitWrapper;
  workspaceRoot: string;
}): Promise<string[]> {
  const own = path.resolve(options.workspaceRoot);
  let listed: string[] = [];
  try {
    listed = (await options.git.worktreeList()).map((worktree) => path.resolve(worktree.path));
  } catch {
    listed = [];
  }

  const roots = new Set<string>([own, ...listed]);
  return [...roots];
}
