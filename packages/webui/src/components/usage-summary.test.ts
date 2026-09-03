import { describe, expect, it } from "vitest";
import type { Event } from "@openspec-ui/core/browser";
import { summarizeUsage } from "./usage-summary.js";

const base = { runId: "run-1", timestamp: "t" };

function stageStarted(stage: string, agentId: string): Event {
  return { ...base, kind: "stageStarted", stage, agentId } as Event;
}

function usageReported(usage: Record<string, unknown>): Event {
  return { ...base, kind: "usageReported", usage } as Event;
}

function usageUpdate(update: Record<string, unknown>): Event {
  return { ...base, kind: "agentUpdate", update: { sessionUpdate: "usage_update", ...update } } as Event;
}

describe("summarizeUsage — attribution", () => {
  it("attributes a report to the stage most recently announced", () => {
    const summary = summarizeUsage([
      stageStarted("propose", "claude-cli-acp"),
      usageReported({ inputTokens: 100, outputTokens: 20, costUsd: 0.1 }),
      stageStarted("apply", "claude-cli-acp"),
      usageReported({ inputTokens: 900, outputTokens: 300, costUsd: 1.5 }),
    ]);

    expect(summary.stages.map((stage) => stage.stage)).toEqual(["propose", "apply"]);
    expect(summary.stages[0]?.reported).toEqual({ inputTokens: 100, outputTokens: 20, costUsd: 0.1 });
    expect(summary.stages[1]?.reported).toEqual({ inputTokens: 900, outputTokens: 300, costUsd: 1.5 });
    expect(summary.totals).toMatchObject({ inputTokens: 1000, outputTokens: 320, costUsd: 1.6 });
  });

  it("counts usage reported before any stage was announced, belonging to no stage", () => {
    // A single-command run through the AI panel, not a chain: there is no
    // stage to attribute to, and dropping the figure would under-report.
    const summary = summarizeUsage([usageReported({ outputTokens: 7, costUsd: 0.02 })]);

    expect(summary.stages).toEqual([]);
    expect(summary.totals).toEqual({ outputTokens: 7, costUsd: 0.02 });
    expect(summary.anyReported).toBe(true);
  });

  it("keeps the last report within one stage, and sums across stages", () => {
    // Matches enforcement exactly: `agent-runner.ts` keeps a run's LAST
    // report as its audit entry, and `buildUsageReport` then sums the
    // entries. Summing within a stage would show more than the ceiling is
    // comparing against.
    const summary = summarizeUsage([
      stageStarted("apply", "claude-cli-acp"),
      usageReported({ outputTokens: 10 }),
      usageReported({ outputTokens: 25 }),
      stageStarted("verify", "claude-cli-acp"),
      usageReported({ outputTokens: 5 }),
    ]);

    expect(summary.stages[0]?.reported).toEqual({ outputTokens: 25 });
    expect(summary.totals.outputTokens).toBe(30);
  });

  it("names the stage a chain stopped during — the case no stage boundary covers", () => {
    const summary = summarizeUsage([
      stageStarted("propose", "claude-cli"),
      stageStarted("apply", "claude-cli"),
      usageReported({ costUsd: 4 }),
      { ...base, kind: "failed", reason: "agent crashed" } as Event,
    ]);

    expect(summary.stages.map((stage) => [stage.stage, stage.state])).toEqual([
      ["propose", "completed"],
      ["apply", "failed"],
    ]);
    expect(summary.stages[1]?.reported).toEqual({ costUsd: 4 });
  });

  it("marks the stage a run was cancelled during", () => {
    const summary = summarizeUsage([
      stageStarted("apply", "copilot-cli-acp"),
      { ...base, kind: "cancelled" } as Event,
    ]);

    expect(summary.stages[0]?.state).toBe("cancelled");
  });
});

describe("summarizeUsage — never inventing a figure", () => {
  it("leaves a stage that reported nothing without any reported usage, not at zero", () => {
    // Asserted explicitly. A summary that showed "$0.00" for an
    // unmeasured stage would claim it was free, which is the reading
    // `AuditEntry.usage` and `checkBudget` were both written to avoid.
    const summary = summarizeUsage([
      stageStarted("propose", "claude-cli"),
      stageStarted("apply", "claude-cli-acp"),
      usageReported({ costUsd: 2 }),
    ]);

    expect(summary.stages[0]?.reported).toBeUndefined();
    expect(summary.stages[1]?.reported).toEqual({ costUsd: 2 });
    expect(summary.totals.costUsd).toBe(2);
  });

  it("reports nothing at all for a run in which no agent reported", () => {
    const summary = summarizeUsage([
      stageStarted("propose", "claude-cli"),
      { ...base, kind: "completed" } as Event,
    ]);

    expect(summary.anyReported).toBe(false);
    expect(summary.totals).toEqual({});
  });

  it("keeps a zero an agent actually reported distinct from no report", () => {
    const summary = summarizeUsage([stageStarted("apply", "claude-cli-acp"), usageReported({ costUsd: 0 })]);

    expect(summary.stages[0]?.reported).toEqual({ costUsd: 0 });
    expect(summary.anyReported).toBe(true);
  });
});

describe("summarizeUsage — currencies", () => {
  it("keeps two currencies apart instead of summing them", () => {
    const summary = summarizeUsage([
      stageStarted("propose", "claude-cli-acp"),
      usageReported({ costUsd: 1.25 }),
      stageStarted("apply", "copilot-cli-acp"),
      usageReported({ cost: { amount: 30, currency: "credits" } }),
    ]);

    expect(summary.totals.costUsd).toBe(1.25);
    expect(summary.totals.otherCosts).toEqual({ credits: 30 });
  });

  it("sums two amounts in the same non-USD currency, and no further", () => {
    const summary = summarizeUsage([
      stageStarted("propose", "copilot-cli-acp"),
      usageReported({ cost: { amount: 30, currency: "credits" } }),
      stageStarted("apply", "copilot-cli-acp"),
      usageReported({ cost: { amount: 12, currency: "credits" } }),
    ]);

    expect(summary.totals.otherCosts).toEqual({ credits: 42 });
    expect(summary.totals.costUsd).toBeUndefined();
  });
});

describe("summarizeUsage — live figures", () => {
  it("keeps the latest usage_update per stage, and never counts `used` as tokens spent", () => {
    const summary = summarizeUsage([
      stageStarted("apply", "copilot-cli-acp"),
      usageUpdate({ used: 40_000, size: 200_000, cost: { amount: 0.2, currency: "USD" } }),
      usageUpdate({ used: 90_000, size: 200_000, cost: { amount: 0.44, currency: "USD" } }),
    ]);

    expect(summary.stages[0]?.live).toEqual({ used: 90_000, size: 200_000, cost: { amount: 0.44, currency: "USD" } });
    // `used` is context occupancy — it falls after a compaction. Counting
    // it would under-report exactly the long runs that compact.
    expect(summary.totals.inputTokens).toBeUndefined();
    expect(summary.totals.outputTokens).toBeUndefined();
    expect(summary.totals.costUsd).toBeUndefined();
    expect(summary.anyReported).toBe(false);
  });

  it("ignores agent updates that are not usage_update", () => {
    const summary = summarizeUsage([
      stageStarted("apply", "copilot-cli-acp"),
      { ...base, kind: "agentUpdate", update: { sessionUpdate: "agent_message_chunk" } } as Event,
    ]);

    expect(summary.stages[0]?.live).toBeUndefined();
  });
});
