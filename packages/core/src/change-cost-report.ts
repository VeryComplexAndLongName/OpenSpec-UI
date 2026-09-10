// What one change cost, read back from the audit log — alongside
// usage-report.ts, and a pure function over entries for the same reason:
// this module never reads a file or spawns anything, so a host supplies
// whatever entries it has (an `AuditLog`'s in-memory list, or a
// `FileAuditLog`'s parsed JSONL).
//
// The live usage summary answers the same question while a run is
// happening, by reading the event stream. Events are not kept. This reads
// what is.

import type { AgentUsage } from "./agent-usage.js";
import { isRunEntry } from "./audit-runs.js";
import type { HarnessEffort } from "./harness-step-agent.js";
import type { HarnessStage } from "./harness-stage.js";
import type { AuditEntry, AuditOutcome } from "./security.js";

/** How a run ended, or that it has not. `"running"` is a `started` entry
 * with no terminal one after it — the editor closed mid-run, and giving
 * it an end time it never had would invent a duration. */
export type ChangeCostOutcome = AuditOutcome | "running";

export interface ChangeCostRow {
  /** Absent for a record written before stages were attributed, and for
   * a single-stage run that belongs to no chain. Such a row is shown, not
   * dropped and not guessed: dropping makes the total wrong, guessing
   * makes a row wrong. */
  stage?: HarnessStage;
  agent: string;
  effort?: HarnessEffort;
  outcome: ChangeCostOutcome;
  /** Why the run ended this way, where the record says — a ceiling
   * naming itself, or a failure's reason. */
  reason?: string;
  /** Absent means the agent reported nothing, which is not zero. Six of
   * the ten supported agents report nothing at all. */
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Absent while a run is still open. */
  durationMs?: number;
  startedAt: string;
}

export interface ChangeCostReport {
  rows: ChangeCostRow[];
  /** Totals over **what was reported only**. A change whose stages
   * half-reported has a total that covers half of it, and a caller must
   * say so rather than present this as the change's cost. */
  reportedCostUsd?: number;
  reportedInputTokens?: number;
  reportedOutputTokens?: number;
  /** Summed over rows that have one; a still-running row contributes
   * nothing rather than a guess. */
  totalDurationMs?: number;
  /** Rows whose agent reported no usage at all. Counted so a caller can
   * say what the totals do not cover. */
  rowsWithNothingReported: number;
  /** `false` when nothing has ever run against this change — distinct
   * from a change that ran and reported nothing. */
  hasRecords: boolean;
}

const TERMINAL: ReadonlySet<AuditOutcome> = new Set<AuditOutcome>(["completed", "failed", "cancelled", "blocked"]);

function usageFigures(usage: AgentUsage | undefined): Pick<ChangeCostRow, "costUsd" | "inputTokens" | "outputTokens"> {
  if (!usage) return {};
  return {
    ...(usage.costUsd !== undefined ? { costUsd: usage.costUsd } : {}),
    ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
    ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
  };
}

function elapsedMs(startedAt: string, endedAt: string): number | undefined {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
  const elapsed = end - start;
  return elapsed >= 0 ? elapsed : undefined;
}

/** What has been spent against one change, a row per run.
 *
 * Pairing is by **order**, not by key alone: a chain that returned from
 * `verify` to `apply` has two `started` and two terminal entries sharing
 * a `runId` and a `stage`, and matching on the key would take the wrong
 * end time. Each `started` takes the next unclaimed terminal entry with
 * the same pair.
 *
 * Entries that are not runs are dropped first (`isRunEntry`). A checks
 * entry carries a terminal outcome and no `started` partner, so the
 * unpaired-entry pass below read it as "a run refused before it
 * started" — and one chain run of apply and verify then told the
 * recommendation that counts these rows there had been two previous
 * runs. It is a fact about the run beside it, not a run; what it found
 * is read back by `verify-quality.ts`. */
export function buildChangeCostReport(entries: readonly AuditEntry[], changeDir: string): ChangeCostReport {
  const mine = entries.filter((entry) => entry.changeDir === changeDir && isRunEntry(entry));
  if (mine.length === 0) {
    return { rows: [], rowsWithNothingReported: 0, hasRecords: false };
  }

  const claimed = new Set<number>();
  const rows: ChangeCostRow[] = [];

  // The separator is written as an escape, not as the byte itself. A raw
  // control byte makes the whole file binary to `grep`, which then skips
  // it silently — this one did, and the file dropped out of every search
  // across the codebase until someone noticed while looking at something
  // else. See source-stays-text.
  const keyOf = (entry: AuditEntry): string => `${entry.runId}\u0000${entry.stage ?? ""}`;

  mine.forEach((entry, index) => {
    if (entry.outcome !== "started") return;
    const key = keyOf(entry);
    let terminal: AuditEntry | undefined;
    for (let next = index + 1; next < mine.length; next += 1) {
      const candidate = mine[next] as AuditEntry;
      if (claimed.has(next) || !TERMINAL.has(candidate.outcome) || keyOf(candidate) !== key) continue;
      claimed.add(next);
      terminal = candidate;
      break;
    }
    const duration = terminal ? elapsedMs(entry.timestamp, terminal.timestamp) : undefined;
    rows.push({
      ...(entry.stage !== undefined ? { stage: entry.stage } : {}),
      agent: entry.agent,
      ...(entry.effort !== undefined ? { effort: entry.effort } : {}),
      outcome: terminal ? terminal.outcome : "running",
      ...(terminal?.reason !== undefined ? { reason: terminal.reason } : {}),
      ...usageFigures(terminal?.usage),
      ...(duration !== undefined ? { durationMs: duration } : {}),
      startedAt: entry.timestamp,
    });
  });

  // A run refused before it started writes one terminal entry and no
  // `started` — it never ran, and it still belongs in the record.
  mine.forEach((entry, index) => {
    if (entry.outcome === "started" || claimed.has(index)) return;
    rows.push({
      ...(entry.stage !== undefined ? { stage: entry.stage } : {}),
      agent: entry.agent,
      ...(entry.effort !== undefined ? { effort: entry.effort } : {}),
      outcome: entry.outcome,
      ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
      ...usageFigures(entry.usage),
      startedAt: entry.timestamp,
    });
  });

  rows.sort((left, right) => left.startedAt.localeCompare(right.startedAt));

  let cost: number | undefined;
  let input: number | undefined;
  let output: number | undefined;
  let duration: number | undefined;
  let nothingReported = 0;
  for (const row of rows) {
    if (row.costUsd !== undefined) cost = (cost ?? 0) + row.costUsd;
    if (row.inputTokens !== undefined) input = (input ?? 0) + row.inputTokens;
    if (row.outputTokens !== undefined) output = (output ?? 0) + row.outputTokens;
    if (row.durationMs !== undefined) duration = (duration ?? 0) + row.durationMs;
    if (row.costUsd === undefined && row.inputTokens === undefined && row.outputTokens === undefined) {
      nothingReported += 1;
    }
  }

  return {
    rows,
    ...(cost !== undefined ? { reportedCostUsd: cost } : {}),
    ...(input !== undefined ? { reportedInputTokens: input } : {}),
    ...(output !== undefined ? { reportedOutputTokens: output } : {}),
    ...(duration !== undefined ? { totalDurationMs: duration } : {}),
    rowsWithNothingReported: nothingReported,
    hasRecords: true,
  };
}
