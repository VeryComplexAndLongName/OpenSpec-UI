import { describe, expect, it } from "vitest";
import { buildChangeCostReport } from "./change-cost-report.js";
import type { AuditEntry } from "./security.js";

// what-a-change-cost:
// pure function over in-memory entries — no file, no process, no
// temporary directory. Measured 2026-09-08 at under 20ms for the whole
// file, so the package's own default timeout is ample.

const CHANGE = "/repo/openspec/changes/demo";

function entry(partial: Partial<AuditEntry> & Pick<AuditEntry, "runId" | "outcome" | "timestamp">): AuditEntry {
  return {
    agent: "claude-cli-acp",
    cwd: "/repo",
    changeDir: CHANGE,
    ...partial,
  } as AuditEntry;
}

describe("buildChangeCostReport", () => {
  it("produces a row per stage, with agent, effort, spend and duration", () => {
    const report = buildChangeCostReport([
      entry({ runId: "r1", outcome: "started", timestamp: "2026-09-08T10:00:00.000Z", stage: "apply", effort: "high" }),
      entry({
        runId: "r1",
        outcome: "completed",
        timestamp: "2026-09-08T10:02:00.000Z",
        stage: "apply",
        effort: "high",
        usage: { costUsd: 1.25, inputTokens: 100, outputTokens: 20 },
      }),
    ], CHANGE);

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      stage: "apply",
      agent: "claude-cli-acp",
      effort: "high",
      outcome: "completed",
      costUsd: 1.25,
      durationMs: 120_000,
    });
    expect(report.reportedCostUsd).toBe(1.25);
  });

  it("gives a stage that ran twice two rows, each with its own duration", () => {
    // The pairing case a key-only match gets wrong: both attempts share a
    // runId and a stage, so the first `started` must take the first
    // terminal entry, not the last.
    const report = buildChangeCostReport([
      entry({ runId: "r1", outcome: "started", timestamp: "2026-09-08T10:00:00.000Z", stage: "apply" }),
      entry({ runId: "r1", outcome: "cancelled", timestamp: "2026-09-08T10:01:00.000Z", stage: "apply" }),
      entry({ runId: "r1", outcome: "started", timestamp: "2026-09-08T10:05:00.000Z", stage: "apply" }),
      entry({ runId: "r1", outcome: "completed", timestamp: "2026-09-08T10:08:00.000Z", stage: "apply" }),
    ], CHANGE);

    expect(report.rows.map((row) => row.durationMs)).toEqual([60_000, 180_000]);
  });

  it("shows nothing reported rather than zero, and counts those rows", () => {
    const report = buildChangeCostReport([
      entry({ runId: "r1", outcome: "started", timestamp: "2026-09-08T10:00:00.000Z", stage: "apply", agent: "codex-cli" }),
      entry({ runId: "r1", outcome: "completed", timestamp: "2026-09-08T10:01:00.000Z", stage: "apply", agent: "codex-cli" }),
    ], CHANGE);

    expect(report.rows[0]?.costUsd).toBeUndefined();
    expect(report.rows[0]?.inputTokens).toBeUndefined();
    expect(report.reportedCostUsd).toBeUndefined();
    expect(report.rowsWithNothingReported).toBe(1);
  });

  it("keeps a record that names no stage, as unattributed, still counted", () => {
    const report = buildChangeCostReport([
      entry({ runId: "old", outcome: "started", timestamp: "2026-09-01T10:00:00.000Z" }),
      entry({
        runId: "old",
        outcome: "completed",
        timestamp: "2026-09-01T10:01:00.000Z",
        usage: { costUsd: 0.5 },
      }),
    ], CHANGE);

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.stage).toBeUndefined();
    // Dropping it would make the total wrong; guessing a stage would make
    // the row wrong.
    expect(report.reportedCostUsd).toBe(0.5);
  });

  it("reports a run that never ended as still running, with no duration", () => {
    const report = buildChangeCostReport([
      entry({ runId: "r1", outcome: "started", timestamp: "2026-09-08T10:00:00.000Z", stage: "verify" }),
    ], CHANGE);

    expect(report.rows[0]?.outcome).toBe("running");
    expect(report.rows[0]?.durationMs).toBeUndefined();
    expect(report.totalDurationMs).toBeUndefined();
  });

  it("carries the reason a cut run recorded", () => {
    const report = buildChangeCostReport([
      entry({ runId: "r1", outcome: "started", timestamp: "2026-09-08T10:00:00.000Z", stage: "apply" }),
      entry({
        runId: "r1",
        outcome: "cancelled",
        timestamp: "2026-09-08T10:10:00.000Z",
        stage: "apply",
        reason: 'stopped "apply" at the stage time limit: timeout.maxStageSeconds is 600s',
      }),
    ], CHANGE);

    expect(report.rows[0]?.outcome).toBe("cancelled");
    expect(report.rows[0]?.reason).toContain("maxStageSeconds");
  });

  it("says nothing has run when the change has no records", () => {
    const report = buildChangeCostReport([
      entry({ runId: "other", outcome: "completed", timestamp: "2026-09-08T10:00:00.000Z", changeDir: "/repo/openspec/changes/elsewhere" }),
    ], CHANGE);

    expect(report.hasRecords).toBe(false);
    expect(report.rows).toEqual([]);
  });

  it("keeps a run refused before it started, which writes no started entry", () => {
    const report = buildChangeCostReport([
      entry({ runId: "r1", outcome: "blocked", timestamp: "2026-09-08T10:00:00.000Z", reason: "not permitted by the allowlist" }),
    ], CHANGE);

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ outcome: "blocked", reason: "not permitted by the allowlist" });
  });
});
