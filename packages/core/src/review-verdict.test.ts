import { describe, expect, it } from "vitest";
import { readReviewVerdict, readReviewVerdictLine } from "./review-verdict.js";

// the-plan-is-updated-from-its-review 1.4: the review's closing line, read as
// a marker.
describe("readReviewVerdictLine", () => {
  it.each([
    ["Review verdict: ready", "ready"],
    ["Review verdict: changes needed", "changes-needed"],
    ["**Review verdict: changes needed**", "changes-needed"],
    ["**Review verdict:** changes needed.", "changes-needed"],
    ["- Review verdict: `ready`", "ready"],
    ["## Review verdict: Changes needed", "changes-needed"],
    ["> Review verdict: ready.", "ready"],
  ])("reads %s", (line, verdict) => {
    expect(readReviewVerdictLine(line)).toBe(verdict);
  });

  it.each([
    "The plan looks ready.",
    "Review verdict: mostly ready",
    "My review verdict: ready",
    "Review verdict: ready, after the fixes below",
    "Review verdict:",
  ])("does not read %s", (line) => {
    expect(readReviewVerdictLine(line)).toBeUndefined();
  });
});

describe("readReviewVerdict", () => {
  it("takes the last verdict line of a reply", () => {
    expect(readReviewVerdict("Review verdict: ready\n\nOn second thought:\n\nReview verdict: changes needed\n")).toBe("changes-needed");
  });

  it("has none where no line states one", () => {
    expect(readReviewVerdict("## Should fix before apply\n\n1. Task 8.1 breaks the banner.")).toBeUndefined();
  });
});
