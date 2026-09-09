import { describe, expect, it } from "vitest";
import {
  checkScheduleTime,
  describeLateness,
  readSchedule,
  withoutEntry,
  type ScheduledRun,
} from "./scheduled-runs.js";

// a-run-can-be-scheduled:
// pure against a fixed clock — no files, no timers, no waiting.

const known = { active: ["demo", "other"], archived: ["2026-09-01-old"] };

function entry(changeName: string, startAt: string): ScheduledRun {
  return { changeName, path: "chain", startAt, requestedAt: "2026-09-09T08:00:00.000Z" };
}

describe("readSchedule", () => {
  it("separates what is due from what is not, against the clock it is given", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");

    const reading = readSchedule(
      [entry("demo", "2026-09-09T11:00:00.000Z"), entry("other", "2026-09-09T18:00:00.000Z")],
      known,
      now,
    );

    expect(reading.start?.entry.changeName).toBe("demo");
    expect(reading.start?.lateByMs).toBe(60 * 60 * 1000);
    expect(reading.pending.map((item) => item.changeName)).toEqual(["other"]);
  });

  it("starts the oldest and reports the rest as waiting", () => {
    // The workspace lease refuses a second mutating run, so starting both
    // would produce a refusal that reads as a fault.
    const reading = readSchedule(
      [entry("other", "2026-09-09T11:30:00.000Z"), entry("demo", "2026-09-09T09:00:00.000Z")],
      known,
      new Date("2026-09-09T12:00:00.000Z"),
    );

    expect(reading.start?.entry.changeName).toBe("demo");
    expect(reading.waiting.map((item) => item.entry.changeName)).toEqual(["other"]);
  });

  it("drops an entry for a change that no longer exists, and says it did", () => {
    // Neither active nor archived means deleted, and a schedule for it
    // would wait forever.
    const reading = readSchedule(
      [entry("deleted-experiment", "2026-09-09T09:00:00.000Z")],
      known,
      new Date("2026-09-09T12:00:00.000Z"),
    );

    expect(reading.start).toBeUndefined();
    expect(reading.dropped.map((item) => item.changeName)).toEqual(["deleted-experiment"]);
  });

  it("finds a change that was archived after being scheduled", () => {
    // The prefix `openspec archive` adds must not lose someone's
    // schedule.
    const reading = readSchedule(
      [entry("old", "2026-09-09T09:00:00.000Z")],
      known,
      new Date("2026-09-09T12:00:00.000Z"),
    );

    expect(reading.start?.entry.changeName).toBe("old");
  });

  it("drops a time it cannot read rather than keeping a permanent pending", () => {
    const reading = readSchedule([entry("demo", "not a time")], known, new Date("2026-09-09T12:00:00.000Z"));

    expect(reading.dropped).toHaveLength(1);
    expect(reading.pending).toEqual([]);
  });
});

describe("describeLateness", () => {
  it("says a run is starting now when it is on time", () => {
    // "Started on time" and "nothing was said" have to look different.
    const text = describeLateness({ entry: entry("demo", "2026-09-09T12:00:00.000Z"), lateByMs: 500 });

    expect(text).toContain("starting now");
  });

  it("carries how late, in the unit a person would use", () => {
    expect(describeLateness({ entry: entry("demo", "2026-09-09T09:00:00.000Z"), lateByMs: 25 * 60_000 }))
      .toContain("25 minutes late");
    expect(describeLateness({ entry: entry("demo", "2026-09-09T09:00:00.000Z"), lateByMs: 3 * 60 * 60_000 }))
      .toContain("3 hours late");
    expect(describeLateness({ entry: entry("demo", "2026-09-07T09:00:00.000Z"), lateByMs: 50 * 60 * 60_000 }))
      .toContain("2 days late");
  });
});

describe("checkScheduleTime", () => {
  it("refuses a time that has already passed", () => {
    // Accepting one and firing at once answers a different question than
    // the one asked, and the mistyped hour is learned too late.
    expect(checkScheduleTime("2026-09-09T09:00:00.000Z", new Date("2026-09-09T12:00:00.000Z")))
      .toContain("already passed");
  });

  it("refuses a time it cannot read", () => {
    expect(checkScheduleTime("tomorrow-ish", new Date("2026-09-09T12:00:00.000Z"))).toBeDefined();
  });

  it("accepts a time still ahead", () => {
    expect(checkScheduleTime("2026-09-09T18:00:00.000Z", new Date("2026-09-09T12:00:00.000Z"))).toBeUndefined();
  });
});

describe("withoutEntry", () => {
  it("removes the one that started and keeps another for the same change", () => {
    // The same change may be scheduled twice; starting one must not
    // cancel the other.
    const first = entry("demo", "2026-09-09T09:00:00.000Z");
    const second = entry("demo", "2026-09-09T18:00:00.000Z");

    expect(withoutEntry([first, second], first)).toEqual([second]);
  });
});
