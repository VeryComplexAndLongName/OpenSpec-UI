import { describe, expect, it } from "vitest";
import { buildUsageReport } from "./usage-report.js";
import type { AuditEntry } from "./security.js";

function startedAndCompleted(overrides: {
  runId: string;
  agent: string;
  changeDir: string;
  usage?: AuditEntry["usage"];
}): AuditEntry[] {
  return [
    {
      runId: overrides.runId,
      agent: overrides.agent,
      outcome: "started",
      cwd: "/repo",
      timestamp: "t0",
      changeDir: overrides.changeDir,
    },
    {
      runId: overrides.runId,
      agent: overrides.agent,
      outcome: "completed",
      cwd: "/repo",
      timestamp: "t1",
      changeDir: overrides.changeDir,
      usage: overrides.usage,
    },
  ];
}

describe("buildUsageReport", () => {
  it("sums totals per agent and per model across entries (task 5.3)", () => {
    const entries: AuditEntry[] = [
      ...startedAndCompleted({
        runId: "run-1",
        agent: "claude-cli",
        changeDir: "/repo/openspec/changes/a",
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          costUsd: 0.26,
          byModel: { "claude-opus": { inputTokens: 60, outputTokens: 30, costUsd: 0.2 }, "claude-haiku": { inputTokens: 40, outputTokens: 20, costUsd: 0.06 } },
        },
      }),
      ...startedAndCompleted({
        runId: "run-2",
        agent: "claude-cli",
        changeDir: "/repo/openspec/changes/a",
        usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.02, byModel: { "claude-opus": { inputTokens: 10, outputTokens: 5, costUsd: 0.02 } } },
      }),
      ...startedAndCompleted({
        runId: "run-3",
        agent: "copilot-cli",
        changeDir: "/repo/openspec/changes/b",
        usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.01 },
      }),
    ];

    const report = buildUsageReport(entries);

    expect(report.totalsByAgent["claude-cli"]).toEqual({ runCount: 2, invocationCount: 2, costReportedInvocationCount: 2, inputTokens: 110, outputTokens: 55, costUsd: 0.28, costByUnit: {} });
    expect(report.totalsByAgent["copilot-cli"]).toEqual({ runCount: 1, invocationCount: 1, costReportedInvocationCount: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.01, costByUnit: {} });
    expect(report.totalsByModel["claude-opus"]).toEqual({ runCount: 2, invocationCount: 2, costReportedInvocationCount: 2, inputTokens: 70, outputTokens: 35, costUsd: 0.22, costByUnit: {} });
    expect(report.totalsByModel["claude-haiku"]).toEqual({ runCount: 1, invocationCount: 1, costReportedInvocationCount: 1, inputTokens: 40, outputTokens: 20, costUsd: 0.06, costByUnit: {} });
    expect(report.totalsByChange["/repo/openspec/changes/a"]).toEqual({ runCount: 2, invocationCount: 2, costReportedInvocationCount: 2, inputTokens: 110, outputTokens: 55, costUsd: 0.28, costByUnit: {} });
    expect(report.totalsByChange["/repo/openspec/changes/b"]).toEqual({ runCount: 1, invocationCount: 1, costReportedInvocationCount: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.01, costByUnit: {} });
    expect(report.unmeasuredRunCount).toBe(0);
  });

  it("counts a run with no usage once as unmeasured, not once per its audit entry (task 5.2, 5.3)", () => {
    const entries: AuditEntry[] = [
      ...startedAndCompleted({ runId: "run-4", agent: "claude-cli", changeDir: "/repo/openspec/changes/a" }),
      ...startedAndCompleted({
        runId: "run-5",
        agent: "claude-cli",
        changeDir: "/repo/openspec/changes/a",
        usage: { costUsd: 0.05 },
      }),
    ];

    const report = buildUsageReport(entries);

    expect(report.unmeasuredRunCount).toBe(1);
    expect(report.totalsByAgent["claude-cli"]).toEqual({ runCount: 1, invocationCount: 1, costReportedInvocationCount: 1, inputTokens: 0, outputTokens: 0, costUsd: 0.05, costByUnit: {} });
    expect(report.totalsByChange["/repo/openspec/changes/a"]).toEqual({ runCount: 1, invocationCount: 1, costReportedInvocationCount: 1, inputTokens: 0, outputTokens: 0, costUsd: 0.05, costByUnit: {} });
  });

  it("produces a zero report for no runs at all, not an error (task 5.3)", () => {
    const report = buildUsageReport([]);

    expect(report).toEqual({
      totalsByAgent: {},
      totalsByModel: {},
      totalsByChange: {},
      unmeasuredRunCount: 0,
      unmeasuredInvocationCount: 0,
    });
  });
});

// a-run-budget-has-a-unit: an agent billed in something other than
// dollars reports `cost: { amount, currency }`, kept whole.
describe("buildUsageReport - what was reported in another unit", () => {
  it("sums each unit on its own, folding the spelling of the unit", () => {
    const report = buildUsageReport([
      ...startedAndCompleted({ runId: "r1", agent: "copilot-cli", changeDir: "/repo/openspec/changes/a", usage: { cost: { amount: 12, currency: "credits" } } }),
      ...startedAndCompleted({ runId: "r2", agent: "copilot-cli", changeDir: "/repo/openspec/changes/a", usage: { cost: { amount: 8, currency: "Credits" } } }),
      ...startedAndCompleted({ runId: "r3", agent: "some-agent", changeDir: "/repo/openspec/changes/a", usage: { cost: { amount: 5, currency: "EUR" } } }),
    ]);

    expect(report.totalsByChange["/repo/openspec/changes/a"]?.costByUnit).toEqual({ credits: 20, eur: 5 });
  });

  it("never folds another unit into the dollar total", () => {
    const report = buildUsageReport([
      ...startedAndCompleted({ runId: "r1", agent: "copilot-cli", changeDir: "/repo/openspec/changes/a", usage: { cost: { amount: 12, currency: "credits" } } }),
    ]);

    expect(report.totalsByChange["/repo/openspec/changes/a"]?.costUsd).toBeUndefined();
  });
});

describe("invocation usage accounting", () => {
  const base: AuditEntry = {
    runId: "chain", agent: "codex-cli-acp", cwd: "/repo", timestamp: "t",
    outcome: "completed", changeDir: "/repo/openspec/changes/demo",
  };

  it("keeps every stage and repeated invocation under the same chain runId", () => {
    const entries: AuditEntry[] = [100, 200, 300].flatMap((inputTokens, index) => [
      { ...base, invocationId: `call-${index}`, stage: "review", outcome: "started" },
      { ...base, invocationId: `call-${index}`, stage: "review", usage: { inputTokens, outputTokens: 10 } },
    ]);
    // The same invocation can be encountered twice when a retained log is
    // copied. Its explicit identity prevents double-counting.
    entries.push(entries[1]!);
    const report = buildUsageReport(entries);
    expect(report.totalsByAgent[base.agent]).toMatchObject({ runCount: 1, invocationCount: 3, inputTokens: 600, outputTokens: 30 });
    expect(report.totalsByChange[base.changeDir!]?.inputTokens).toBe(600);
    expect(report.unmeasuredRunCount).toBe(0);
    expect(report.unmeasuredInvocationCount).toBe(0);
  });

  it("keeps every legacy terminal usage, including repeated stages and terminal-only records", () => {
    const report = buildUsageReport([
      { ...base, outcome: "started", stage: "review" },
      { ...base, stage: "review", usage: { inputTokens: 100 } },
      { ...base, outcome: "started", stage: "review" },
      { ...base, stage: "review", usage: { inputTokens: 200 } },
      { ...base, stage: "apply", usage: { inputTokens: 300 } },
      { ...base, agent: "chain" },
      { ...base, agent: "verify-checks" },
      { ...base, outcome: "message" },
    ]);
    expect(report.totalsByAgent[base.agent]).toMatchObject({ runCount: 1, invocationCount: 3, inputTokens: 600 });
    expect(report.unmeasuredInvocationCount).toBe(0);
  });

  it("counts an unmeasured invocation separately inside a partly measured chain", () => {
    const report = buildUsageReport([
      { ...base, invocationId: "measured", usage: { outputTokens: 5 } },
      { ...base, invocationId: "silent", outcome: "started" },
      { ...base, invocationId: "silent", outcome: "failed" },
    ]);
    expect(report.unmeasuredRunCount).toBe(0);
    expect(report.unmeasuredInvocationCount).toBe(1);
  });

  it("preserves unknown, partial and explicitly zero USD coverage", () => {
    const unknown = buildUsageReport([{ ...base, usage: { inputTokens: 20 } }]).totalsByAgent[base.agent]!;
    expect(unknown).not.toHaveProperty("costUsd");
    expect(unknown.costReportedInvocationCount).toBe(0);
    const partial = buildUsageReport([
      { ...base, invocationId: "one", usage: { inputTokens: 20 } },
      { ...base, invocationId: "two", usage: { costUsd: 0 } },
    ]).totalsByAgent[base.agent]!;
    expect(partial).toMatchObject({ costUsd: 0, invocationCount: 2, costReportedInvocationCount: 1 });
    expect(JSON.parse(JSON.stringify(unknown))).not.toHaveProperty("costUsd");
    const adjustment = buildUsageReport([{ ...base, usage: { costUsd: -0.5 } }]).totalsByAgent[base.agent]!;
    expect(adjustment).toMatchObject({ costUsd: -0.5, costReportedInvocationCount: 1 });
  });

  it("retains token categories and model attribution without adding the breakdown twice", () => {
    const figures = { inputTokens: 12, outputTokens: 3, cacheReadInputTokens: 86656, cacheCreationInputTokens: 0, thoughtTokens: 2 };
    const report = buildUsageReport([{ ...base, usage: {
      ...figures, byModel: { "reported-model": figures }, byModelAttribution: "current-model",
    } }]);
    expect(report.totalsByAgent[base.agent]).toMatchObject(figures);
    expect(report.totalsByChange[base.changeDir!]).toMatchObject(figures);
    expect(report.totalsByModel["reported-model"]).toMatchObject({ ...figures, currentModelAttributionInvocationCount: 1 });
    expect(report.totalsByAgent[base.agent]?.inputTokens).toBe(12);
  });
});
