import { describe, expect, it } from "vitest";
import { formatTaskProgress, taskCompletionPercent } from "./task-progress.js";

describe("taskCompletionPercent", () => {
  it("returns null when there are no tasks at all", () => {
    expect(taskCompletionPercent(0, 0)).toBeNull();
  });

  it("rounds a normal fraction", () => {
    expect(taskCompletionPercent(1, 3)).toBe(33);
  });

  it("returns 0 for zero completed of a positive total", () => {
    expect(taskCompletionPercent(0, 16)).toBe(0);
  });

  it("returns 100 when all tasks are complete", () => {
    expect(taskCompletionPercent(20, 20)).toBe(100);
  });
});

describe("formatTaskProgress", () => {
  it("shows only the fraction when there are no tasks at all", () => {
    expect(formatTaskProgress(0, 0)).toBe("0/0");
  });

  it("shows the fraction and percentage otherwise", () => {
    expect(formatTaskProgress(4, 17)).toBe("4/17 (24%)");
    expect(formatTaskProgress(0, 16)).toBe("0/16 (0%)");
    expect(formatTaskProgress(20, 20)).toBe("20/20 (100%)");
  });
});
