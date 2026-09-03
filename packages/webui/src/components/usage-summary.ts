// Turns a run's event list into what it has spent, per stage and in
// total. Pure and transport-agnostic — the same shape `collapseStreamEvents`
// has, and testable without rendering anything.
//
// Two kinds of number arrive here and are deliberately kept apart:
//
//   settled  — a `usageReported` event, emitted once per run when the
//              agent reports its total. This is the same figure
//              `agent-runner.ts` writes into the audit entry, so it is
//              what a configured ceiling is actually compared against.
//   live     — an ACP `usage_update` notification, arriving repeatedly
//              during a run inside an `agentUpdate`. Its `used` is how
//              much of the context window is occupied and goes *down*
//              after a compaction, so it is never consumption and never
//              enters a token total (see usage-from-acp's design).
//
// Nothing here invents a figure. A stage whose agent reported nothing has
// no `reported` at all, which is different from reporting zero — the same
// distinction `AuditEntry.usage` draws, where absent means unreported and
// `checkBudget` fails open on it.

import type { AgentUsage, Event, HarnessStage } from "@openspec-ui/core/browser";

/** Summed token counts and USD cost. Every field stays `undefined` until
 * something reported it — a zero here would claim a run was free. */
export interface UsageTotals {
  inputTokens?: number;
  outputTokens?: number;
  thoughtTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  costUsd?: number;
  /** Costs an agent reported in a currency other than USD, summed per
   * currency code and never folded into `costUsd`. Converting would mean
   * inventing an exchange rate — see LIMITS.md, "Why there is no single
   * `budget: number`". */
  otherCosts?: Record<string, number>;
}

/** The agent's own live report during a run: what ACP's `usage_update`
 * carries. Shown as the agent's running commentary, never added into
 * `UsageTotals`. */
export interface LiveUsage {
  /** Tokens currently occupying the context window — NOT tokens spent. */
  used?: number;
  /** The context window's size, when the agent reported one. */
  size?: number;
  /** The agent's own running cost for the turn so far. */
  cost?: { amount: number; currency: string };
}

export type StageState = "running" | "completed" | "failed" | "cancelled";

export interface StageUsage {
  stage: HarnessStage;
  /** The agent that ran it, or `""` for a stage that runs no agent
   * (`archive`, `git`). */
  agentId: string;
  state: StageState;
  /** What this stage's agent reported, or `undefined` when it reported
   * nothing. Absent is not zero. */
  reported?: UsageTotals;
  /** The agent's latest live figures for this stage, where it sends any. */
  live?: LiveUsage;
}

export interface UsageSummary {
  stages: StageUsage[];
  /** Every stage's settled usage, summed. Also `undefined`-per-field
   * until something reported. */
  totals: UsageTotals;
  /** False when nothing in this run reported anything at all — the state
   * in which a ceiling counts nothing and cannot fire. */
  anyReported: boolean;
}

const TOKEN_FIELDS = [
  "inputTokens",
  "outputTokens",
  "thoughtTokens",
  "cacheReadInputTokens",
  "cacheCreationInputTokens",
] as const;

/** `a + b`, but `undefined + undefined` stays `undefined`. Adding a
 * reported number to an unreported one yields the reported number, not
 * `NaN` and not a zero-seeded sum. */
function addOptional(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a + b;
}

function addTotals(into: UsageTotals, from: UsageTotals): UsageTotals {
  const result: UsageTotals = { ...into };
  for (const field of TOKEN_FIELDS) result[field] = addOptional(result[field], from[field]);
  result.costUsd = addOptional(result.costUsd, from.costUsd);
  if (from.otherCosts) {
    const other = { ...(result.otherCosts ?? {}) };
    for (const [currency, amount] of Object.entries(from.otherCosts)) {
      other[currency] = (other[currency] ?? 0) + amount;
    }
    result.otherCosts = other;
  }
  return result;
}

/** The project's own `AgentUsage` as this view's totals. A non-USD `cost`
 * becomes an `otherCosts` entry under its own code rather than being
 * converted. */
function totalsFromUsage(usage: AgentUsage): UsageTotals {
  const totals: UsageTotals = {};
  for (const field of TOKEN_FIELDS) {
    const value = usage[field];
    if (value !== undefined) totals[field] = value;
  }
  if (usage.costUsd !== undefined) totals.costUsd = usage.costUsd;
  if (usage.cost) totals.otherCosts = { [usage.cost.currency]: usage.cost.amount };
  return totals;
}

export function hasAnyFigure(totals: UsageTotals | undefined): boolean {
  if (!totals) return false;
  if (TOKEN_FIELDS.some((field) => totals[field] !== undefined)) return true;
  if (totals.costUsd !== undefined) return true;
  return Object.keys(totals.otherCosts ?? {}).length > 0;
}

function readLiveUsage(update: Record<string, unknown>): LiveUsage | undefined {
  if (update.sessionUpdate !== "usage_update") return undefined;
  const live: LiveUsage = {};
  if (typeof update.used === "number") live.used = update.used;
  if (typeof update.size === "number") live.size = update.size;
  const cost = update.cost as { amount?: unknown; currency?: unknown } | undefined;
  if (cost && typeof cost.amount === "number" && typeof cost.currency === "string") {
    live.cost = { amount: cost.amount, currency: cost.currency };
  }
  return Object.keys(live).length > 0 ? live : undefined;
}

/**
 * Builds the summary for one run's events, in arrival order.
 *
 * Attribution follows `stageStarted`: a `usageReported` belongs to the
 * stage most recently announced. Usage arriving before any `stageStarted`
 * (a single-command run rather than a chain) belongs to no stage and is
 * still counted in the total.
 *
 * Within one stage the LAST report wins, and across stages they sum —
 * exactly what enforcement does. `agent-runner.ts` keeps the last report
 * as a run's audit entry (an agent may report progressively, and the
 * final report describes the whole run), and `buildUsageReport` then sums
 * the entries. Summing within a stage here would show a larger figure
 * than the ceiling is comparing against.
 */
export function summarizeUsage(events: readonly Event[]): UsageSummary {
  const stages: StageUsage[] = [];
  let current: StageUsage | undefined;
  // The last report from a run with no stage of its own.
  let unstagedReport: UsageTotals | undefined;

  function settle(state: StageState): void {
    if (current && current.state === "running") current.state = state;
  }

  for (const event of events) {
    switch (event.kind) {
      case "stageStarted": {
        settle("completed");
        current = { stage: event.stage, agentId: event.agentId, state: "running" };
        stages.push(current);
        break;
      }
      case "usageReported": {
        const totals = totalsFromUsage(event.usage);
        if (current) current.reported = totals;
        else unstagedReport = totals;
        break;
      }
      case "agentUpdate": {
        const live = readLiveUsage(event.update);
        if (live && current) current.live = live;
        break;
      }
      case "failed":
        settle("failed");
        break;
      case "cancelled":
        settle("cancelled");
        break;
      case "completed":
        settle("completed");
        break;
      default:
        break;
    }
  }

  let totals: UsageTotals = {};
  for (const stage of stages) {
    if (stage.reported) totals = addTotals(totals, stage.reported);
  }
  if (unstagedReport) totals = addTotals(totals, unstagedReport);

  return { stages, totals, anyReported: hasAnyFigure(totals) };
}
