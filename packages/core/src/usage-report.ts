// Aggregates recorded usage across audit entries — alongside
// sprint-report.ts/change-timeline.ts's existing reporting modules (see
// design.md, "Goals"). A pure function over whatever entries its caller
// supplies (an `AuditLog`'s in-memory entries, or a `FileAuditLog`'s
// parsed JSONL) — this module never reads a file or spawns a process
// itself.
//
// One run can produce more than one `AuditEntry` (a "started" record and
// a terminal "completed"/"failed"/"cancelled" one sharing the same
// `runId` — see agent-runner.ts) but usage, when reported at all, arrives
// only on the terminal one (design.md's "Trade-off": `total_cost_usd`
// arrives with the final result message). Totals are grouped by `runId`
// first, so a run's two entries are never double-counted — once as
// measured, once as unmeasured.

import type { AgentUsage, AgentUsageByModel } from "./agent-usage.js";
import type { AuditEntry } from "./security.js";

export interface UsageTotal {
  runCount: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface UsageReport {
  totalsByAgent: Record<string, UsageTotal>;
  totalsByModel: Record<string, UsageTotal>;
  totalsByChange: Record<string, UsageTotal>;
  /** Count of runs whose entries carry no `usage` at all — reported
   * separately, never folded into any total as zero cost (see design.md's
   * "Risks", and ADR 0017's rejection of estimates). */
  unmeasuredRunCount: number;
}

function emptyTotal(): UsageTotal {
  return { runCount: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
}

function addTotal(totals: Record<string, UsageTotal>, key: string, usage: AgentUsage | AgentUsageByModel): void {
  const total = totals[key] ?? (totals[key] = emptyTotal());
  total.runCount += 1;
  total.inputTokens += usage.inputTokens ?? 0;
  total.outputTokens += usage.outputTokens ?? 0;
  total.costUsd += usage.costUsd ?? 0;
}

function groupByRunId(entries: AuditEntry[]): Map<string, AuditEntry[]> {
  const runs = new Map<string, AuditEntry[]>();
  for (const entry of entries) {
    const existing = runs.get(entry.runId);
    if (existing) {
      existing.push(entry);
    } else {
      runs.set(entry.runId, [entry]);
    }
  }
  return runs;
}

export function buildUsageReport(entries: AuditEntry[]): UsageReport {
  const totalsByAgent: Record<string, UsageTotal> = {};
  const totalsByModel: Record<string, UsageTotal> = {};
  const totalsByChange: Record<string, UsageTotal> = {};
  let unmeasuredRunCount = 0;

  for (const runEntries of groupByRunId(entries).values()) {
    const usageEntry = runEntries.find((entry) => entry.usage !== undefined);
    if (!usageEntry?.usage) {
      unmeasuredRunCount += 1;
      continue;
    }

    addTotal(totalsByAgent, usageEntry.agent, usageEntry.usage);

    const changeDir = runEntries.find((entry) => entry.changeDir !== undefined)?.changeDir;
    if (changeDir) addTotal(totalsByChange, changeDir, usageEntry.usage);

    for (const [model, modelUsage] of Object.entries(usageEntry.usage.byModel ?? {})) {
      addTotal(totalsByModel, model, modelUsage);
    }
  }

  return { totalsByAgent, totalsByModel, totalsByChange, unmeasuredRunCount };
}
