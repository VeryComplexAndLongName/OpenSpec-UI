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

    expect(report.totalsByAgent["claude-cli"]).toEqual({ runCount: 2, inputTokens: 110, outputTokens: 55, costUsd: 0.28 });
    expect(report.totalsByAgent["copilot-cli"]).toEqual({ runCount: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.01 });
    expect(report.totalsByModel["claude-opus"]).toEqual({ runCount: 2, inputTokens: 70, outputTokens: 35, costUsd: 0.22 });
    expect(report.totalsByModel["claude-haiku"]).toEqual({ runCount: 1, inputTokens: 40, outputTokens: 20, costUsd: 0.06 });
    expect(report.totalsByChange["/repo/openspec/changes/a"]).toEqual({ runCount: 2, inputTokens: 110, outputTokens: 55, costUsd: 0.28 });
    expect(report.totalsByChange["/repo/openspec/changes/b"]).toEqual({ runCount: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.01 });
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
    expect(report.totalsByAgent["claude-cli"]).toEqual({ runCount: 1, inputTokens: 0, outputTokens: 0, costUsd: 0.05 });
    expect(report.totalsByChange["/repo/openspec/changes/a"]).toEqual({ runCount: 1, inputTokens: 0, outputTokens: 0, costUsd: 0.05 });
  });

  it("produces a zero report for no runs at all, not an error (task 5.3)", () => {
    const report = buildUsageReport([]);

    expect(report).toEqual({
      totalsByAgent: {},
      totalsByModel: {},
      totalsByChange: {},
      unmeasuredRunCount: 0,
    });
  });
});
