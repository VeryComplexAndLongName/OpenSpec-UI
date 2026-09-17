import { describe, expect, it } from "vitest";
import type { ChangeTimeline, ChangeTimelineTask } from "./change-timeline-client.js";
import {
  formatMoment,
  formatMomentDay,
  formatSpan,
  openTasks,
  taskNumberAndTitle,
  taskSentence,
  timelineDates,
  timelineMoments,
  timelineTile,
  undatedDoneTasks,
} from "./timeline-moments.js";

// the-change-timeline-looks-like-the-mockup 1.7.

const NONE = { date: null, day: null, source: "none" as const };

function task(lineNumber: number, text: string, partial: Partial<ChangeTimelineTask> = {}): ChangeTimelineTask {
  return { lineNumber, text, done: true, date: null, lastTouchedDate: null, ...partial };
}

function timeline(partial: Partial<ChangeTimeline> = {}): ChangeTimeline {
  return {
    changeName: "2026-09-14-a-run-says-which-task-it-is-on",
    archived: true,
    dates: {
      proposed: { date: "2026-09-13T15:40:00.000Z", day: "2026-09-13", source: "git-commit" },
      firstWorked: { date: "2026-09-13T20:16:00.000Z", day: "2026-09-13", source: "git-blame" },
      lastWorked: { date: "2026-09-14T01:47:00.000Z", day: "2026-09-14", source: "git-blame" },
      archived: { date: "2026-09-14T01:47:00.000Z", day: "2026-09-14", source: "git-commit" },
    },
    createdDate: "2026-09-13T15:40:00.000Z",
    archivedDate: "2026-09-14",
    proposal: "",
    design: "",
    specs: [],
    tasks: [
      task(5, "1.1 commandInstruction in the shared agent instructions", { date: "2026-09-13T20:16:00.000Z" }),
      task(6, "1.2 shared.test.ts pins the instruction", { date: "2026-09-13T20:16:00.000Z" }),
      task(9, "6.2 Run npm run verify unpiped", { date: "2026-09-13T21:13:00.000Z" }),
      task(12, "6.5 Delegated to claude-cli: find out which agents deliver a marker", { date: "2026-09-14T01:47:00.000Z" }),
    ],
    ...partial,
  };
}

describe("timelineMoments", () => {
  it("orders the proposal, each instant tasks were ticked at, and the archive", () => {
    const moments = timelineMoments(timeline());
    expect(moments.map((moment) => moment.kind)).toEqual(["proposed", "tasks", "tasks", "tasks", "archived"]);
    const first = moments[1];
    expect(first?.kind === "tasks" ? first.tasks.map((t) => t.lineNumber) : []).toEqual([5, 6]);
    // The last task and the archive share an instant; the archive comes after.
    expect(moments[3]?.at).toBe(moments[4]?.at);
    expect(moments[4]).toEqual({ kind: "archived", at: "2026-09-14T01:47:00.000Z", folder: "2026-09-14-a-run-says-which-task-it-is-on" });
    // A folder name gives a day with no time: shown as the day, placed after
    // that day's ticks.
    const byFolder = timelineMoments(timeline({
      dates: { ...timeline().dates, archived: { date: "2026-09-14T00:00:00.000Z", day: "2026-09-14", source: "folder-name" } },
    }));
    expect(byFolder.at(-1)).toMatchObject({ kind: "archived", day: "2026-09-14" });
  });

  it("groups on the instant, not the day, and keeps tasks.md order within a moment", () => {
    const moments = timelineMoments(timeline({
      tasks: [
        task(8, "2.2 later line", { date: "2026-09-13T20:16:00+03:00" }),
        task(3, "2.1 earlier line", { date: "2026-09-13T17:16:00.000Z" }),
        task(4, "2.3 a minute on", { date: "2026-09-13T17:17:00.000Z" }),
      ],
    })).filter((moment) => moment.kind === "tasks");
    expect(moments.map((moment) => moment.kind === "tasks" ? moment.tasks.map((t) => t.text) : [])).toEqual([
      ["2.1 earlier line", "2.2 later line"],
      ["2.3 a minute on"],
    ]);
  });

  it("has no moment for what has no date, and none for an active change's archive", () => {
    const moments = timelineMoments(timeline({
      archived: false,
      dates: { proposed: NONE, firstWorked: NONE, lastWorked: NONE, archived: NONE },
      tasks: [task(1, "1.1 no date"), task(2, "1.2 open", { done: false, date: "2026-09-13T17:16:00.000Z" })],
    }));
    expect(moments).toEqual([]);
  });
});

describe("taskSentence", () => {
  it("joins the lines a task is wrapped onto and takes off the bold and code marks", () => {
    expect(taskSentence({ text: "6.5 **Delegated to claude-cli**: run `npm run verify` and", continued: "record each count." }))
      .toBe("6.5 Delegated to claude-cli: run npm run verify and record each count.");
    expect(taskSentence({ text: "1.1 Fits its line" })).toBe("1.1 Fits its line");
  });
});

describe("taskNumberAndTitle", () => {
  it("splits a leading dotted number from the rest", () => {
    expect(taskNumberAndTitle("6.2 Run npm run verify")).toEqual({ number: "6.2", title: "Run npm run verify" });
    expect(taskNumberAndTitle("Done")).toEqual({ title: "Done" });
  });
});

describe("openTasks and undatedDoneTasks", () => {
  it("lists open tasks with staleness by the threshold, and done tasks with no date", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const change = timeline({
      tasks: [
        task(2, "1.2 fresh", { done: false, lastTouchedDate: "2026-09-16T12:00:00.000Z" }),
        task(1, "1.1 old", { done: false, lastTouchedDate: "2026-08-01T12:00:00.000Z" }),
        task(3, "1.3 done, no date"),
      ],
    });
    expect(openTasks(change, 14, now).map((open) => [open.task.text, open.stale])).toEqual([["1.1 old", true], ["1.2 fresh", false]]);
    expect(openTasks(change, 60, now).map((open) => open.stale)).toEqual([false, false]);
    expect(undatedDoneTasks(change).map((t) => t.text)).toEqual(["1.3 done, no date"]);
  });
});

describe("timelineTile", () => {
  it("gives done of total and the span from proposal to archive", () => {
    expect(timelineTile(timeline())).toEqual({ done: 4, total: 4, span: "proposed to archived in 10 h 07 min" });
  });

  it("measures an active change to its last work, and gives no span without both dates", () => {
    expect(timelineTile(timeline({ archived: false })).span).toBe("proposed to last worked in 10 h 07 min");
    const undated = timeline({ dates: { ...timeline().dates, proposed: NONE } });
    expect(timelineTile(undated).span).toBeUndefined();
  });
});

describe("formatSpan", () => {
  it("says minutes, hours and minutes, or days and hours", () => {
    expect(formatSpan(45 * 60_000)).toBe("45 min");
    expect(formatSpan((10 * 60 + 7) * 60_000)).toBe("10 h 07 min");
    expect(formatSpan((3 * 24 + 4) * 3_600_000)).toBe("3 d 4 h");
  });
});

describe("timelineDates", () => {
  it("names each date's source, and leaves the archive out for an active change", () => {
    const rows = timelineDates(timeline({
      dates: {
        proposed: { date: "2026-09-13T15:40:00.000Z", day: "2026-09-13", source: "git-commit" },
        firstWorked: { date: "2026-09-13T20:16:00.000Z", day: "2026-09-13", source: "audit-log" },
        lastWorked: { date: null, day: null, source: "unreadable" },
        archived: { date: "2026-09-14T00:00:00.000Z", day: "2026-09-14", source: "folder-name" },
      },
    }));
    expect(rows.map((row) => [row.label, row.source])).toEqual([
      ["Proposed", "from a git commit"],
      ["First worked", "from the audit log"],
      ["Last worked", "could not be read"],
      ["Archived", "from the archive folder's name"],
    ]);
    expect(timelineDates(timeline(), "Europe/Moscow").map((row) => row.when)).toEqual([
      "Sun 13 Sep, 18:40", "Sun 13 Sep, 23:16", "Mon 14 Sep, 04:47", "Mon 14 Sep, 04:47",
    ]);
    // A folder name holds a day and no time; an unreadable date has no reading.
    expect(rows.map((row) => row.when)).toEqual([expect.any(String), expect.any(String), undefined, "Mon 14 Sep"]);
    expect(timelineDates(timeline({ archived: false })).map((row) => row.label)).toEqual(["Proposed", "First worked", "Last worked"]);
    expect(timelineDates(timeline({ dates: { ...timeline().dates, firstWorked: NONE } }))[1]?.source).toBe("not recorded");
    expect(timelineDates(timeline())[2]?.source).toBe("from git blame on tasks.md");
  });
});

describe("formatMoment", () => {
  it("reads as the mockup does, in the zone it is given", () => {
    expect(formatMoment("2026-09-13T15:40:00.000Z", "Europe/Moscow")).toBe("Sun 13 Sep, 18:40");
    expect(formatMoment("2026-09-13T22:13:00.000Z", "Europe/Moscow")).toBe("Mon 14 Sep, 01:13");
    expect(formatMoment("not a date")).toBe("not a date");
  });

  it("reads a day with no time as that calendar day, in any zone", () => {
    expect(formatMomentDay("2026-09-14")).toBe("Mon 14 Sep");
    expect(formatMomentDay("soon")).toBe("soon");
  });
});
