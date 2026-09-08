import { describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "./test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const { renderChangeCostReport } = await import("./commands.js");

describe("renderChangeCostReport", () => {
  it("says nothing has run, rather than printing an empty table", () => {
    const text = renderChangeCostReport("demo", { rows: [], rowsWithNothingReported: 0, hasRecords: false });

    expect(text).toContain("Nothing has run against this change");
    expect(text).not.toContain("| Stage |");
  });

  it("prints a figure the agent never reported as not reported, never as zero", () => {
    // The line this repository has already refused once, in the live
    // panel: a silent agent shown at $0.00 is a lie where a reader is
    // least able to check it.
    const text = renderChangeCostReport("demo", {
      rows: [{ stage: "apply", agent: "codex-cli", outcome: "completed", startedAt: "2026-09-08T10:00:00.000Z" }],
      rowsWithNothingReported: 1,
      hasRecords: true,
    });

    expect(text).toContain("not reported");
    expect(text).not.toContain("$0.00");
    expect(text).toContain("reported nothing at all");
  });

  it("marks an unattributed row and explains what that means", () => {
    const text = renderChangeCostReport("demo", {
      rows: [{ agent: "claude-cli", outcome: "completed", startedAt: "2026-09-01T10:00:00.000Z", costUsd: 0.5 }],
      reportedCostUsd: 0.5,
      rowsWithNothingReported: 0,
      hasRecords: true,
    });

    expect(text).toContain("_unattributed_");
    expect(text).toContain("counted in the totals and not guessed at");
  });

  it("lists how runs ended where a record says", () => {
    const text = renderChangeCostReport("demo", {
      rows: [{
        stage: "apply",
        agent: "claude-cli-acp",
        outcome: "cancelled",
        reason: 'stopped "apply" at the stage time limit: timeout.maxStageSeconds is 600s',
        startedAt: "2026-09-08T10:00:00.000Z",
      }],
      rowsWithNothingReported: 1,
      hasRecords: true,
    });

    expect(text).toContain("How runs ended");
    expect(text).toContain("maxStageSeconds is 600s");
  });

  it("shows a run that never ended as still running", () => {
    const text = renderChangeCostReport("demo", {
      rows: [{ stage: "verify", agent: "claude-cli", outcome: "running", startedAt: "2026-09-08T10:00:00.000Z" }],
      rowsWithNothingReported: 1,
      hasRecords: true,
    });

    expect(text).toContain("still running");
  });
});
