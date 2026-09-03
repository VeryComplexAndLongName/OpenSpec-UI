// What a run has spent, shown while it is still running — per stage and
// in total. Reads the event stream the panel already receives (see
// usage-summary.ts); it never fetches, polls, or recomputes anything the
// core decides.
//
// This view does not enforce anything. `HarnessChainRunner.checkBudget`
// compares recorded audit usage at stage boundaries, and a stage already
// running is never interrupted by it (ADR 0018 decision 7). A configured
// ceiling is shown here so it is legible, not so it is applied twice with
// two different numbers.

import type { Event, HarnessBudget } from "@openspec-ui/core/browser";
import { type StageUsage, type UsageTotals, hasAnyFigure, summarizeUsage } from "./usage-summary.js";

export interface UsageSummaryViewProps {
  events: readonly Event[];
  /** The resolved harness `budget`, when the host could resolve one.
   * Absent means no ceiling is shown — never a ceiling of zero, and never
   * wording implying one exists. */
  budget?: HarnessBudget;
}

function formatTokens(value: number): string {
  return value.toLocaleString();
}

function formatUsd(value: number): string {
  // Four decimals below a cent: a stage that cost $0.0031 reads as
  // "$0.0031", not as "$0.00", which would be indistinguishable from the
  // unreported case this whole view is careful about.
  return value >= 0.01 || value === 0 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}

function tokenTotal(totals: UsageTotals): number | undefined {
  // Only what an agent said it consumed. Cache reads and thinking tokens
  // are reported separately by the agents that separate them, and are
  // shown in their own right rather than folded in here — this figure is
  // the one `checkBudget` compares against `maxTokens`.
  if (totals.inputTokens === undefined && totals.outputTokens === undefined) return undefined;
  return (totals.inputTokens ?? 0) + (totals.outputTokens ?? 0);
}

export function describeTotals(totals: UsageTotals): string {
  const parts: string[] = [];
  if (totals.inputTokens !== undefined) parts.push(`${formatTokens(totals.inputTokens)} in`);
  if (totals.outputTokens !== undefined) parts.push(`${formatTokens(totals.outputTokens)} out`);
  if (totals.thoughtTokens !== undefined) parts.push(`${formatTokens(totals.thoughtTokens)} thinking`);
  if (totals.cacheReadInputTokens !== undefined) parts.push(`${formatTokens(totals.cacheReadInputTokens)} cached`);
  if (totals.costUsd !== undefined) parts.push(formatUsd(totals.costUsd));
  for (const [currency, amount] of Object.entries(totals.otherCosts ?? {})) {
    // Kept in the currency the agent reported. Converting would mean
    // inventing a rate — see LIMITS.md.
    parts.push(`${amount.toLocaleString()} ${currency}`);
  }
  return parts.join(", ");
}

function describeStageFigure(stage: StageUsage): string {
  if (hasAnyFigure(stage.reported)) return describeTotals(stage.reported as UsageTotals);
  if (stage.state === "running") return "running…";
  // Never "$0.00": this agent said nothing, which is not the same as
  // saying the stage was free.
  return "not reported";
}

function describeLive(stage: StageUsage): string | undefined {
  const live = stage.live;
  if (!live) return undefined;
  const parts: string[] = [];
  if (live.cost) {
    parts.push(
      live.cost.currency.toUpperCase() === "USD"
        ? `${formatUsd(live.cost.amount)} so far`
        : `${live.cost.amount.toLocaleString()} ${live.cost.currency} so far`,
    );
  }
  if (live.used !== undefined) {
    // Context occupancy, labelled as such. It falls after a compaction,
    // so it is never presented as an amount spent.
    parts.push(live.size !== undefined
      ? `context ${formatTokens(live.used)} / ${formatTokens(live.size)}`
      : `context ${formatTokens(live.used)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** The ceiling line, or `undefined` when no ceiling is configured — in
 * which case nothing at all is rendered about limits. */
function describeBudget(totals: UsageTotals, budget: HarnessBudget | undefined): string | undefined {
  if (!budget) return undefined;
  const parts: string[] = [];
  if (budget.maxCostUsd !== undefined) {
    parts.push(
      totals.costUsd !== undefined
        ? `${formatUsd(totals.costUsd)} of ${formatUsd(budget.maxCostUsd)}`
        : `nothing recorded yet, of ${formatUsd(budget.maxCostUsd)}`,
    );
  }
  if (budget.maxTokens !== undefined) {
    const used = tokenTotal(totals);
    parts.push(
      used !== undefined
        ? `${formatTokens(used)} of ${formatTokens(budget.maxTokens)} tokens`
        : `no tokens recorded yet, of ${formatTokens(budget.maxTokens)}`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** State → the event-log class whose colour already means the same thing,
 * rather than a second palette meaning the same four things. A running
 * stage gets no modifier, exactly like an ordinary event line. */
const STATE_CLASS: Record<StageUsage["state"], string> = {
  running: "",
  completed: " openspec-event--completed",
  failed: " openspec-event--failed",
  cancelled: " openspec-event--failed",
};

export function UsageSummaryView({ events, budget }: UsageSummaryViewProps) {
  const summary = summarizeUsage(events);
  const budgetLine = describeBudget(summary.totals, budget);

  if (summary.stages.length === 0 && !summary.anyReported) return null;

  return (
    <section className="openspec-usage-summary" data-testid="usage-summary">
      <div className="openspec-usage-summary-head">
        <strong>Usage</strong>
        <span data-testid="usage-total">
          {summary.anyReported ? describeTotals(summary.totals) : "nothing reported"}
        </span>
      </div>
      {budgetLine ? (
        <p className="openspec-usage-budget" data-testid="usage-budget">
          Ceiling: {budgetLine}. Reaching it stops the chain before the next stage; it does not interrupt the stage
          already running.
        </p>
      ) : null}
      {!summary.anyReported ? (
        <p className="openspec-usage-note" data-testid="usage-none-note">
          No agent in this run has reported what it spent. The raw-text CLIs report nothing at all, and a ceiling over
          them counts nothing — see LIMITS.md.
        </p>
      ) : null}
      <ul className="openspec-usage-stages" data-testid="usage-stages">
        {summary.stages.map((stage, index) => {
          const live = describeLive(stage);
          return (
            <li
              key={`${stage.stage}-${index}`}
              className={`openspec-usage-stage${STATE_CLASS[stage.state]}`}
              data-testid={`usage-stage-${stage.stage}`}
              data-state={stage.state}
            >
              <span className="openspec-usage-stage-name">
                {stage.stage}
                {stage.agentId ? ` (${stage.agentId})` : ""}
              </span>
              <span className="openspec-usage-stage-figure">{describeStageFigure(stage)}</span>
              {live ? (
                <span className="openspec-usage-stage-live" data-testid={`usage-live-${stage.stage}`}>
                  live: {live}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
