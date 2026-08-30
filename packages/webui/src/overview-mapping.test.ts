import { afterEach, describe, expect, it, vi } from "vitest";
import { toChangeState, toChangeSummary } from "./overview-mapping.js";

describe("toChangeState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes through each known ChangeState value unchanged", () => {
    expect(toChangeState("draft")).toBe("draft");
    expect(toChangeState("in-progress")).toBe("in-progress");
    expect(toChangeState("implemented")).toBe("implemented");
    expect(toChangeState("archived")).toBe("archived");
  });

  it("falls back to in-progress and warns for an unrecognized CLI status string", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(toChangeState("completed")).toBe("in-progress");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("completed");
  });
});

describe("toChangeSummary", () => {
  it("maps an overview item and explicit state into a ChangeSummary", () => {
    const summary = toChangeSummary(
      { name: "old-change", completedTasks: 1, totalTasks: 2, lastModified: "2026-08-01T00:00:00.000Z" },
      "archived",
    );

    expect(summary).toEqual({
      name: "old-change",
      state: "archived",
      completedTasks: 1,
      totalTasks: 2,
      lastModified: "2026-08-01T00:00:00.000Z",
    });
  });
});
