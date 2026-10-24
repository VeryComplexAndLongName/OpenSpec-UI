// Recorded usage, never estimates. A chain's runId is its control identity;
// invocationId identifies each agent call within it (ADR 0053).
import type { AgentUsage, AgentUsageByModel } from "./agent-usage.js";
import { isRunEntry } from "./audit-runs.js";
import type { AuditEntry } from "./security.js";

export interface UsageTotal {
  /** Distinct logical runIds with measured usage in this group. */
  runCount: number;
  /** Measured agent calls, including stages and retries of the same run. */
  invocationCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  thoughtTokens?: number;
  /** Absent until USD was reported; zero is a reported measurement. */
  costUsd?: number;
  costReportedInvocationCount: number;
  /** Present only on model groups affected by vendor current-model attribution. */
  currentModelAttributionInvocationCount?: number;
  /** Non-USD amounts, summed per lowercased unit, never converted. */
  costByUnit: Record<string, number>;
}

export interface UsageReport {
  totalsByAgent: Record<string, UsageTotal>;
  totalsByModel: Record<string, UsageTotal>;
  totalsByChange: Record<string, UsageTotal>;
  /** Logical runs in which no invocation reported usage. */
  unmeasuredRunCount: number;
  /** Individual calls with no usage, including inside measured chains. */
  unmeasuredInvocationCount: number;
}

function emptyTotal(): UsageTotal {
  return { runCount: 0, invocationCount: 0, inputTokens: 0, outputTokens: 0, costReportedInvocationCount: 0, costByUnit: {} };
}

/** Add totals from separate recorded paths, as the budget reader does.
 * Optional figures remain absent until one side actually reported them. */
export function mergeUsageTotals(left: UsageTotal, right: UsageTotal): UsageTotal {
  const units = new Map(Object.entries(left.costByUnit));
  for (const [unit, amount] of Object.entries(right.costByUnit)) units.set(unit, (units.get(unit) ?? 0) + amount);
  const total: UsageTotal = {
    runCount: left.runCount + right.runCount,
    invocationCount: left.invocationCount + right.invocationCount,
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    costReportedInvocationCount: left.costReportedInvocationCount + right.costReportedInvocationCount,
    costByUnit: Object.fromEntries(units),
  };
  for (const field of ["costUsd", "cacheReadInputTokens", "cacheCreationInputTokens", "thoughtTokens", "currentModelAttributionInvocationCount"] as const) {
    if (left[field] !== undefined || right[field] !== undefined) total[field] = (left[field] ?? 0) + (right[field] ?? 0);
  }
  return total;
}

export function unitKey(currency: string): string {
  return currency.trim().toLowerCase();
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isReportedCost(value: unknown): value is number {
  // Preserve a vendor's signed adjustment too; cost is not a token count.
  return typeof value === "number" && Number.isFinite(value);
}

function addTotal(
  totals: Record<string, UsageTotal>, seen: Map<UsageTotal, Set<string>>,
  key: string, runId: string, usage: AgentUsage | AgentUsageByModel, currentModel = false,
): void {
  let total = Object.hasOwn(totals, key) ? totals[key] : undefined;
  if (total === undefined) {
    total = emptyTotal();
    Object.defineProperty(totals, key, { value: total, enumerable: true });
  }
  const runIds = seen.get(total) ?? new Set<string>();
  if (!runIds.has(runId)) total.runCount += 1;
  runIds.add(runId);
  seen.set(total, runIds);
  total.invocationCount += 1;
  if (isAmount(usage.inputTokens)) total.inputTokens += usage.inputTokens;
  if (isAmount(usage.outputTokens)) total.outputTokens += usage.outputTokens;
  for (const field of ["cacheReadInputTokens", "cacheCreationInputTokens", "thoughtTokens"] as const) {
    const value = usage[field];
    if (isAmount(value)) total[field] = (total[field] ?? 0) + value;
  }
  if (isReportedCost(usage.costUsd)) {
    total.costUsd = (total.costUsd ?? 0) + usage.costUsd;
    total.costReportedInvocationCount += 1;
  }
  if (currentModel) total.currentModelAttributionInvocationCount = (total.currentModelAttributionInvocationCount ?? 0) + 1;
  const other = "cost" in usage ? usage.cost : undefined;
  if (other !== undefined && isReportedCost(other.amount) && other.currency.trim().length > 0) {
    const unit = unitKey(other.currency);
    const previous = Object.hasOwn(total.costByUnit, unit) ? total.costByUnit[unit]! : 0;
    Object.defineProperty(total.costByUnit, unit, { value: previous + other.amount, enumerable: true, configurable: true });
  }
}

/** Pair legacy entries in recorded order, without collapsing repeated
 * stages. A pruned start does not discard its terminal usage. */
function invocationEntries(entries: AuditEntry[]): AuditEntry[][] {
  const groups: AuditEntry[][] = [];
  const identified = new Map<string, AuditEntry[]>();
  const pending = new Map<string, AuditEntry[]>();
  for (const entry of entries) {
    if (entry.invocationId) {
      let group = identified.get(entry.invocationId);
      if (!group) {
        group = [];
        identified.set(entry.invocationId, group);
        groups.push(group);
      }
      group.push(entry);
      continue;
    }
    const key = JSON.stringify([entry.agent, entry.stage, entry.command, entry.taskNumber]);
    if (entry.outcome === "started") {
      const group = [entry];
      groups.push(group);
      pending.set(key, group);
    } else {
      const group = pending.get(key);
      if (group) {
        group.push(entry);
        pending.delete(key);
      } else groups.push([entry]);
    }
  }
  return groups;
}

export function buildUsageReport(entries: AuditEntry[]): UsageReport {
  const totalsByAgent: Record<string, UsageTotal> = {};
  const totalsByModel: Record<string, UsageTotal> = {};
  const totalsByChange: Record<string, UsageTotal> = {};
  const seen = new Map<UsageTotal, Set<string>>();
  const runs = new Map<string, AuditEntry[]>();
  for (const entry of entries.filter(isRunEntry)) {
    const group = runs.get(entry.runId) ?? [];
    group.push(entry);
    runs.set(entry.runId, group);
  }
  let unmeasuredRunCount = 0;
  let unmeasuredInvocationCount = 0;
  for (const [runId, runEntries] of runs) {
    let measured = false;
    for (const invocation of invocationEntries(runEntries)) {
      const usageEntry = [...invocation].reverse().find((entry) => entry.usage !== undefined);
      if (!usageEntry?.usage) {
        unmeasuredInvocationCount += 1;
        continue;
      }
      measured = true;
      const usage = usageEntry.usage;
      addTotal(totalsByAgent, seen, usageEntry.agent, runId, usage);
      const changeDir = usageEntry.changeDir ?? invocation.find((entry) => entry.changeDir !== undefined)?.changeDir;
      if (changeDir) addTotal(totalsByChange, seen, changeDir, runId, usage);
      for (const [model, modelUsage] of Object.entries(usage.byModel ?? {})) {
        addTotal(totalsByModel, seen, model, runId, modelUsage, usage.byModelAttribution === "current-model");
      }
    }
    if (!measured) unmeasuredRunCount += 1;
  }
  return { totalsByAgent, totalsByModel, totalsByChange, unmeasuredRunCount, unmeasuredInvocationCount };
}
