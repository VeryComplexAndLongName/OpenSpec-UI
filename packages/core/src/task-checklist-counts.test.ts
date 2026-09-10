import { describe, expect, it } from "vitest";
import { openTaskCount } from "./task-checklist-counts.js";

// a-date-is-one-day-in-every-source:
// pure over items a caller already read — no files.

describe("openTaskCount", () => {
  it("counts the tasks nobody has ticked", () => {
    expect(openTaskCount([{ done: true }, { done: false }, { done: false }])).toBe(2);
  });

  it("counts none over an empty list", () => {
    // Zero here is a fact about a list that exists. Whether a list that
    // could not be read means zero is the caller's question, and its
    // three call sites all answer it by passing nothing at all.
    expect(openTaskCount([])).toBe(0);
  });
});
