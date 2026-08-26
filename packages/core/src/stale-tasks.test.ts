import { describe, expect, it } from "vitest";
import { DEFAULT_STALE_TASK_THRESHOLD_DAYS, findStaleTasks, isTaskStale } from "./stale-tasks.js";
import type { ChangeTimeline, ChangeTimelineTask } from "./change-timeline.js";

const now = new Date("2026-02-01T00:00:00.000Z");

function task(overrides: Partial<ChangeTimelineTask>): ChangeTimelineTask {
  return { lineNumber: 0, text: "a task", done: false, date: null, lastTouchedDate: null, ...overrides };
}

describe("isTaskStale", () => {
  it("flags a pending task last touched well past the threshold", () => {
    const t = task({ lastTouchedDate: "2026-01-01T00:00:00.000Z" }); // 31 days before `now`
    expect(isTaskStale(t, 14, now)).toBe(true);
  });

  it("does not flag a pending task touched recently", () => {
    const t = task({ lastTouchedDate: "2026-01-30T00:00:00.000Z" }); // 2 days before `now`
    expect(isTaskStale(t, 14, now)).toBe(false);
  });

  it("flags exactly at the threshold boundary", () => {
    const t = task({ lastTouchedDate: "2026-01-18T00:00:00.000Z" }); // exactly 14 days before `now`
    expect(isTaskStale(t, 14, now)).toBe(true);
  });

  it("never flags a done task, regardless of lastTouchedDate", () => {
    const t = task({ done: true, lastTouchedDate: "2020-01-01T00:00:00.000Z" });
    expect(isTaskStale(t, 14, now)).toBe(false);
  });

  it("never flags a task with an undeterminable lastTouchedDate", () => {
    const t = task({ lastTouchedDate: null });
    expect(isTaskStale(t, 14, now)).toBe(false);
  });

  it("uses the default 14-day threshold when none is given", () => {
    expect(DEFAULT_STALE_TASK_THRESHOLD_DAYS).toBe(14);
    const justOver = task({ lastTouchedDate: "2026-01-17T00:00:00.000Z" }); // 15 days before `now`
    expect(isTaskStale(justOver, undefined, now)).toBe(true);
  });
});

describe("findStaleTasks", () => {
  it("returns only stale tasks, in their original order", () => {
    const timeline: ChangeTimeline = {
      changeName: "my-change",
      archived: false,
      createdDate: null,
      archivedDate: null,
      proposal: "",
      design: "",
      specs: [],
      tasks: [
        task({ lineNumber: 0, text: "stale", lastTouchedDate: "2026-01-01T00:00:00.000Z" }),
        task({ lineNumber: 1, text: "fresh", lastTouchedDate: "2026-01-30T00:00:00.000Z" }),
        task({ lineNumber: 2, text: "done", done: true, lastTouchedDate: "2026-01-01T00:00:00.000Z" }),
        task({ lineNumber: 3, text: "also stale", lastTouchedDate: "2025-12-01T00:00:00.000Z" }),
      ],
    };

    const stale = findStaleTasks(timeline, 14, now);

    expect(stale.map((t) => t.text)).toEqual(["stale", "also stale"]);
  });
});
