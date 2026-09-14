// How each change's last run ended, read from the repository's audit logs.
//
// A card says `Failed at verify` only if something recorded that the chain
// failed at verify. Since a-card-says-what-its-change-is-doing the chain
// writes that itself, as one ending entry; a log written before then has
// only its stages' entries, and the last terminal one is the best account
// it gives. Every worktree's log is read, because a change run in its own
// worktree records its runs there.

import { CHAIN_ENDING_AGENT_NAME, changeNameOf, isRunEntry } from "./audit-runs.js";
import { createGitWrapper, type GitWrapper } from "./git.js";
import type { LastRun, LastRunsReport } from "./last-runs-facts.js";
import { readRepositoryAuditEntries, type AuditReadCache } from "./repository-audit.js";
import type { AuditEntry } from "./security.js";

export type { LastRun, LastRunsReport } from "./last-runs-facts.js";

/** Lives for the process: the Pipeline asks on every survey, and an
 * unchanged log is not parsed twice. */
const logCache: AuditReadCache = new Map();

/** Each change's latest ended run, across every worktree's audit log. */
export async function readLastRuns(options: {
  workspaceRoot: string;
  git?: Pick<GitWrapper, "worktreeList">;
}): Promise<LastRunsReport> {
  const git = options.git ?? createGitWrapper({ cwd: options.workspaceRoot });
  const entries = await readRepositoryAuditEntries({ git, workspaceRoot: options.workspaceRoot, cache: logCache });
  return lastRunsOf(entries);
}

/** The same answer over entries already read. */
export function lastRunsOf(entries: readonly AuditEntry[]): LastRunsReport {
  const runs = new Map<string, AuditEntry[]>();
  for (const entry of entries) {
    if (!isRunEntry(entry) && entry.agent !== CHAIN_ENDING_AGENT_NAME) continue;
    const group = runs.get(entry.runId);
    if (group !== undefined) group.push(entry);
    else runs.set(entry.runId, [entry]);
  }

  const byChange: Record<string, LastRun> = {};
  for (const [runId, group] of runs) {
    const changeDir = group.find((entry) => entry.changeDir !== undefined)?.changeDir;
    if (changeDir === undefined) continue;
    const change = changeNameOf(changeDir);
    if (change.length === 0) continue;
    const run = endingOf(runId, group);
    if (run === undefined) continue;
    const previous = byChange[change];
    if (previous === undefined || Date.parse(run.endedAt) >= Date.parse(previous.endedAt)) byChange[change] = run;
  }
  return { byChange };
}

type TerminalEntry = AuditEntry & { outcome: LastRun["outcome"] };

function isTerminal(entry: AuditEntry): entry is TerminalEntry {
  return entry.outcome === "completed" || entry.outcome === "failed" || entry.outcome === "cancelled";
}

function endingOf(runId: string, group: readonly AuditEntry[]): LastRun | undefined {
  const chainEnding = group.find((entry): entry is TerminalEntry => entry.agent === CHAIN_ENDING_AGENT_NAME && isTerminal(entry));
  const stageEntries = group.filter((entry) => entry.agent !== CHAIN_ENDING_AGENT_NAME);
  // Without the chain's own ending — a log older than it, or a run that
  // was never a chain — a run has ended only when its last entry is a
  // terminal one. A last `started` is a stage still going, or one that
  // died without saying, and neither is an ending.
  const lastStageEntry = stageEntries.at(-1);
  const ending = chainEnding
    ?? (lastStageEntry !== undefined && isTerminal(lastStageEntry) ? lastStageEntry : undefined);
  if (ending === undefined) return undefined;

  const stage = ending.stage ?? [...stageEntries].reverse().find((entry) => entry.stage !== undefined)?.stage;
  const costs = stageEntries
    .map((entry) => entry.usage?.costUsd)
    .filter((cost): cost is number => typeof cost === "number");
  return {
    runId,
    outcome: ending.outcome,
    endedAt: ending.timestamp,
    ...(stage !== undefined ? { stage } : {}),
    ...(ending.reason !== undefined ? { reason: ending.reason } : {}),
    ...(costs.length > 0 ? { costUsd: costs.reduce((sum, cost) => sum + cost, 0) } : {}),
  };
}
