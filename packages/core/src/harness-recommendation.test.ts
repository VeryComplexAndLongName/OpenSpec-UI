import { describe, expect, it } from "vitest";
import type { ChangeCostReport } from "./change-cost-report.js";
import { recommendTemplate } from "./harness-recommendation.js";

// recommend-a-template:
// pure over in-memory data — no files, no processes. Measured 2026-09-08
// at under 10ms for the whole file.

function history(rows: ChangeCostReport["rows"]): ChangeCostReport {
  return { rows, rowsWithNothingReported: 0, hasRecords: rows.length > 0 };
}

const cutRow = (reason: string) => ({
  stage: "apply" as const,
  agent: "claude-cli-acp",
  outcome: "cancelled" as const,
  reason,
  startedAt: "2026-09-08T10:00:00.000Z",
});

describe("recommendTemplate", () => {
  it("recommends the roomier template for a long change with no history", () => {
    const result = recommendTemplate({ openTaskCount: 31 });

    expect(result.template?.id).toBe("balanced");
    // Said in the same breath as the answer, so a default cannot be
    // mistaken for a finding.
    expect(result.grounds.join(" ")).toContain("no previous run to go on");
    expect(result.grounds.join(" ")).toContain("31 tasks still open");
  });

  it("recommends the thriftier template for a short change with no history", () => {
    const result = recommendTemplate({ openTaskCount: 3 });

    expect(result.template?.id).toBe("min-cost");
    expect(result.grounds.join(" ")).toContain("no previous run to go on");
  });

  it("moves one step roomier when the last run was stopped by a ceiling, naming it", () => {
    const result = recommendTemplate({
      openTaskCount: 4,
      history: history([cutRow('stopped "apply" at the stage time limit: timeout.maxStageSeconds is 1200s')]),
    });

    // min-cost -> balanced
    expect(result.template?.id).toBe("balanced");
    expect(result.grounds.join(" ")).toContain("maxStageSeconds is 1200s");
  });

  it("asks for a person when a ceiling has stopped it more than once", () => {
    // A larger ceiling has already been tried. Proposing a larger one
    // again is the wrong answer, however natural it looks.
    const result = recommendTemplate({
      openTaskCount: 20,
      history: history([cutRow("time limit"), cutRow("time limit again")]),
    });

    expect(result.needsPerson).toBe(true);
    expect(result.template).toBeUndefined();
    expect(result.grounds.join(" ")).toContain("needs a person");
  });

  it("does not move up when previous runs ended normally", () => {
    const result = recommendTemplate({
      openTaskCount: 2,
      history: history([{
        stage: "apply",
        agent: "claude-cli-acp",
        outcome: "completed",
        startedAt: "2026-09-08T10:00:00.000Z",
      }]),
    });

    expect(result.template?.id).toBe("min-cost");
    expect(result.grounds.join(" ")).toContain("no previous run was stopped by a ceiling");
  });

  it("always returns grounds, including when almost nothing is known", () => {
    // An empty grounds list is exactly what silently presenting a default
    // would look like.
    for (const input of [{ openTaskCount: 0 }, { openTaskCount: 99 }]) {
      expect(recommendTemplate(input).grounds.length).toBeGreaterThan(0);
    }
  });
});
