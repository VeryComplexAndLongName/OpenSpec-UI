import { describe, expect, it } from "vitest";
import { lastReviewOf } from "./last-review.js";
import type { AuditEntry } from "./security.js";

// the-plan-is-updated-from-its-review 1.3: the review an update answers.
describe("lastReviewOf", () => {
  const changeDir = "/w/openspec/changes/demo";
  const entry = (partial: Partial<AuditEntry>): AuditEntry => ({
    runId: "r", agent: "claude-cli-acp", outcome: "completed", cwd: "/w", timestamp: "2026-10-07T09:00:00.000Z", changeDir, ...partial,
  });

  it("takes the latest completed review with a summary, by command or by stage", () => {
    const review = lastReviewOf([
      entry({ command: "review", summary: "first", timestamp: "2026-10-07T09:00:00.000Z" }),
      entry({ stage: "review", summary: "second", timestamp: "2026-10-07T10:00:00.000Z", agent: "copilot-cli-acp", reviewVerdict: "changes-needed" }),
      entry({ command: "plan", summary: "a plan", timestamp: "2026-10-07T11:00:00.000Z" }),
    ], "demo");

    expect(review).toEqual({ summary: "second", at: "2026-10-07T10:00:00.000Z", agent: "copilot-cli-acp", verdict: "changes-needed" });
  });

  it("leaves out a review that failed, said nothing, or was of another change", () => {
    expect(lastReviewOf([
      entry({ command: "review", outcome: "failed", summary: "x" }),
      entry({ command: "review", summary: "  " }),
      entry({ command: "review", summary: "other", changeDir: "/w/openspec/changes/other" }),
    ], "demo")).toBeUndefined();
  });
});
