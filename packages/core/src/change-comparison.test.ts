// Every instant here is built with a local-time constructor and every
// expectation is read in local days, because that is what the grid draws:
// a test written in UTC passes in London and fails in Moscow.

import { describe, expect, it } from "vitest";
import {
  COMPARISON_PERIODS,
  comparisonMoment,
  comparisonRows,
  comparisonWindow,
  describeComparison,
  labelSide,
  nowOffset,
  type ComparisonRow,
} from "./change-comparison.js";
import type { ChangeSpan } from "./change-spans.js";
import type { DatedFact } from "./change-dates.js";

/** A local instant, as `new Date(year, month, day, ...)` reads it. */
function at(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function fact(ms: number | null, source: DatedFact["source"] = "git-commit"): DatedFact {
  if (ms === null) return { date: null, day: null, source: "none" };
  const date = new Date(ms);
  return {
    date: date.toISOString(),
    day: `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`,
    source,
  };
}

function span(
  changeName: string,
  proposed: number | null,
  archived: number | null,
  tasks: { done: number; total: number } | null = { done: 3, total: 3 },
): ChangeSpan {
  return {
    changeName,
    archived: archived !== null,
    dates: { proposed: fact(proposed), archived: archived === null ? fact(null) : fact(archived) },
    tasks,
  };
}

const NOW = at(2026, 9, 16, 16, 15);

function rowOf(rows: ComparisonRow[], name: string): ComparisonRow {
  const row = rows.find((candidate) => candidate.changeName === name);
  if (!row) throw new Error(`no row for ${name}: ${rows.map((r) => r.changeName).join(", ")}`);
  return row;
}

describe("comparisonWindow", () => {
  it("covers the period's days, ending with the day now falls in", () => {
    expect(comparisonWindow("2-days", [], NOW).days.map((day) => day.day)).toEqual([
      "2026-09-15",
      "2026-09-16",
    ]);
    const five = comparisonWindow("5-days", [], NOW);
    expect(five.days).toHaveLength(5);
    expect(five.days[0]?.heading).toBe("Sat 12 Sep");
    expect(five.days[4]?.heading).toBe("Wed 16 Sep");
    expect(comparisonWindow("2-weeks", [], NOW).days).toHaveLength(14);
  });

  it("marks Saturday and Sunday", () => {
    const window = comparisonWindow("5-days", [], NOW);
    expect(window.days.map((day) => day.weekend)).toEqual([true, true, false, false, false]);
  });

  it("starts All at the earliest proposed day, and at today with nothing dated", () => {
    const spans = [
      span("2026-08-05-old-change", at(2026, 8, 3, 11, 43), at(2026, 8, 5, 9, 0)),
      span("new-change", at(2026, 9, 15, 9, 0), null),
    ];
    const all = comparisonWindow("all", spans, NOW);
    expect(all.days[0]?.day).toBe("2026-08-03");
    expect(all.days[all.days.length - 1]?.day).toBe("2026-09-16");
    expect(all.days).toHaveLength(45);

    const empty = comparisonWindow("all", [span("undated", null, null)], NOW);
    expect(empty.days).toHaveLength(1);
    expect(empty.days[0]?.day).toBe("2026-09-16");
  });

  it("offers the periods the segmented control shows, in order", () => {
    expect(COMPARISON_PERIODS.map((period) => period.label)).toEqual(["2 days", "5 days", "2 weeks", "All"]);
  });
});

describe("comparisonRows", () => {
  const window = comparisonWindow("5-days", [], NOW);

  it("places a bar by the hour of the day it began and ended", () => {
    const rows = comparisonRows([span("2026-09-13-first", at(2026, 9, 12, 12, 0), at(2026, 9, 13, 12, 0))], window, NOW);

    const bar = rowOf(rows, "2026-09-13-first").bar;
    // Half of the first day of five, and half of the second.
    expect(bar).toMatchObject({ from: 10, to: 30, clippedStart: false, clippedEnd: false });
  });

  it("runs an active change's bar to now", () => {
    const rows = comparisonRows([span("still-open", at(2026, 9, 16, 0, 0), null, { done: 25, total: 27 })], window, NOW);

    const row = rowOf(rows, "still-open");
    expect(row.active).toBe(true);
    expect(row.label).toBe("25 / 27");
    expect(row.bar?.from).toBe(80);
    // 16:15 of the last of five days: four days plus 0.677 of one.
    expect(row.bar?.to).toBeCloseTo(93.54, 1);
    expect(row.bar?.to).toBe(nowOffset(window, NOW));
  });

  it("cuts a bar that began before the window or had not ended when it closed", () => {
    const rows = comparisonRows(
      [
        span("2026-09-14-began-earlier", at(2026, 9, 5, 9, 0), at(2026, 9, 14, 9, 0)),
        span("2026-09-12-ended-inside", at(2026, 9, 12, 0, 0), at(2026, 9, 12, 6, 0)),
      ],
      window,
      NOW,
    );

    const cut = rowOf(rows, "2026-09-14-began-earlier").bar;
    expect(cut).toMatchObject({ from: 0, clippedStart: true, clippedEnd: false });
    expect(rowOf(rows, "2026-09-12-ended-inside").bar?.clippedStart).toBe(false);
  });

  it("leaves out a change whose whole span is before the window", () => {
    const rows = comparisonRows([span("2026-09-02-long-gone", at(2026, 9, 1, 9, 0), at(2026, 9, 2, 9, 0))], window, NOW);

    expect(rows).toEqual([]);
  });

  it("keeps a row with no bar for a change carrying no proposed date", () => {
    const rows = comparisonRows([span("never-committed", null, null, { done: 0, total: 4 })], window, NOW);

    const row = rowOf(rows, "never-committed");
    expect(row.bar).toBeNull();
    expect(row.description).toContain("no proposed date");
    expect(row.label).toBe("0 / 4");
  });

  it("labels an archived change by its task count and a change with no list by saying so", () => {
    const rows = comparisonRows(
      [
        span("2026-09-13-archived-one", at(2026, 9, 12, 9, 0), at(2026, 9, 13, 9, 0), { done: 47, total: 47 }),
        span("2026-09-13-single-task", at(2026, 9, 12, 9, 0), at(2026, 9, 13, 9, 0), { done: 1, total: 1 }),
        span("no-list", at(2026, 9, 14, 9, 0), null, null),
      ],
      window,
      NOW,
    );

    expect(rowOf(rows, "2026-09-13-archived-one").label).toBe("47 tasks");
    expect(rowOf(rows, "2026-09-13-single-task").label).toBe("1 task");
    expect(rowOf(rows, "no-list").label).toBe("no tasks");
  });

  it("orders the rows by when each change was proposed, with the undated last", () => {
    const rows = comparisonRows(
      [
        span("undated", null, null),
        span("2026-09-15-second", at(2026, 9, 14, 9, 0), at(2026, 9, 15, 9, 0)),
        span("first", at(2026, 9, 13, 9, 0), null),
      ],
      window,
      NOW,
    );

    expect(rows.map((row) => row.changeName)).toEqual(["first", "2026-09-15-second", "undated"]);
  });

  it("narrows by part of a change's directory name, its date prefix included", () => {
    const spans = [
      span("2026-09-13-the-pipeline-reads", at(2026, 9, 12, 9, 0), at(2026, 9, 13, 9, 0)),
      span("the-timeline-compares", at(2026, 9, 14, 9, 0), null),
    ];

    expect(comparisonRows(spans, window, NOW, "TIME").map((row) => row.changeName)).toEqual([
      "the-timeline-compares",
    ]);
    expect(comparisonRows(spans, window, NOW, "2026-09-13").map((row) => row.changeName)).toEqual([
      "2026-09-13-the-pipeline-reads",
    ]);
    expect(comparisonRows(spans, window, NOW, "   ")).toHaveLength(2);
  });

  it("names a row without its picture", () => {
    const rows = comparisonRows(
      [span("2026-09-13-first", at(2026, 9, 12, 12, 36), at(2026, 9, 13, 15, 0), { done: 47, total: 47 })],
      window,
      NOW,
    );

    expect(rowOf(rows, "2026-09-13-first").description).toBe(
      "first, archived, proposed Sat 12 Sep, 12:36, archived Sun 13 Sep, 15:00, 47 tasks",
    );
  });
});

describe("labelSide", () => {
  const window = comparisonWindow("5-days", [], NOW);

  it("puts the figures after a bar, and in front of one that ends at the edge", () => {
    const [ending] = comparisonRows([span("late", at(2026, 9, 16, 0, 0), null)], window, NOW);
    const [spanning] = comparisonRows([span("all-week", at(2026, 9, 12, 0, 0), null)], window, NOW);

    expect(labelSide(ending as ComparisonRow)).toBe("before");
    // Nowhere to put them in front, so they stay after it.
    expect(labelSide(spanning as ComparisonRow)).toBe("after");
  });
});

describe("nowOffset", () => {
  it("is null where now is outside the window", () => {
    const window = comparisonWindow("2-days", [], at(2026, 9, 10, 12, 0));

    expect(nowOffset(window, at(2026, 9, 16, 12, 0))).toBeNull();
    expect(nowOffset(window, at(2026, 9, 10, 12, 0))).toBeCloseTo(75, 1);
  });
});

describe("describeComparison", () => {
  const window = comparisonWindow("5-days", [], NOW);

  it("counts the changes and names the days, ending at today", () => {
    const rows = comparisonRows(
      [
        span("2026-09-13-first", at(2026, 9, 12, 9, 0), at(2026, 9, 13, 9, 0)),
        span("second", at(2026, 9, 14, 9, 0), null),
      ],
      window,
      NOW,
    );

    expect(describeComparison(rows, window, NOW)).toBe(
      "2 changes between Sat 12 Sep and today · each bar runs from proposed to archived",
    );
    expect(describeComparison([], window, NOW)).toBe(
      "0 changes between Sat 12 Sep and today · each bar runs from proposed to archived",
    );
  });

  it("names the last day where now is not in the window", () => {
    const earlier = comparisonWindow("2-days", [], at(2026, 9, 10, 12, 0));

    expect(describeComparison([], earlier, NOW)).toContain("between Wed 9 Sep and Thu 10 Sep");
  });
});

describe("comparisonMoment", () => {
  it("gives the day and the time, and the day alone for a date read from a folder name", () => {
    expect(comparisonMoment(fact(at(2026, 9, 12, 12, 36)))).toBe("Sat 12 Sep, 12:36");
    expect(comparisonMoment(fact(at(2026, 9, 12, 0, 0), "folder-name"))).toBe("Sat 12 Sep");
    expect(comparisonMoment(fact(null))).toBeNull();
  });
});
