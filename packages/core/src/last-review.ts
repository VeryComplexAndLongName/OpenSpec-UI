// The review an update answers - the-plan-is-updated-from-its-review, ADR 0041.
//
// An update revises a change's plan from its last review. That review is a
// run of the change whose command was `review`, or a chain's review stage,
// that completed with a summary; its summary is what the reviewer said. It
// is read from every worktree's audit log, since a review may have run in
// the change's own worktree or in the main one.

import { changeNameOf } from "./audit-runs.js";
import type { GitWrapper } from "./git.js";
import { readRepositoryAuditEntries } from "./repository-audit.js";
import type { ReviewVerdict } from "./review-verdict.js";
import type { AuditEntry } from "./security.js";

/** A change's latest completed review. */
export interface LastReview {
  summary: string;
  at: string;
  agent: string;
  verdict?: ReviewVerdict;
}

function isReview(entry: AuditEntry): boolean {
  return entry.command === "review" || entry.stage === "review";
}

/** The latest completed review of `changeName` among `entries`, or
 * `undefined` where it has none. */
export function lastReviewOf(entries: readonly AuditEntry[], changeName: string): LastReview | undefined {
  let last: LastReview | undefined;
  for (const entry of entries) {
    if (entry.outcome !== "completed" || !isReview(entry)) continue;
    if (entry.changeDir === undefined || changeNameOf(entry.changeDir) !== changeName) continue;
    const summary = entry.summary?.trim();
    if (summary === undefined || summary.length === 0) continue;
    if (last !== undefined && Date.parse(entry.timestamp) < Date.parse(last.at)) continue;
    last = {
      summary,
      at: entry.timestamp,
      agent: entry.agent,
      ...(entry.reviewVerdict !== undefined ? { verdict: entry.reviewVerdict } : {}),
    };
  }
  return last;
}

/** The same, read from the repository's audit logs. */
export async function readLastReview(options: {
  git: Pick<GitWrapper, "worktreeList">;
  workspaceRoot: string;
  changeName: string;
}): Promise<LastReview | undefined> {
  const entries = await readRepositoryAuditEntries({ git: options.git, workspaceRoot: options.workspaceRoot }).catch(() => []);
  return lastReviewOf(entries, options.changeName);
}
