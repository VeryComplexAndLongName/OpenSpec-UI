import { describe, expect, it } from "vitest";
import {
  checkScheduleTime,
  describeDrop,
  describeLateness,
  describePathNoLongerOffered,
  describeScheduledRunProblem,
  isScheduledRun,
  planScheduleFiring,
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

  it("drops an entry for a change that no longer exists, and says it was deleted", () => {
    // Neither active nor archived means deleted, and a schedule for it
    // would wait forever.
    const reading = readSchedule(
      [entry("deleted-experiment", "2026-09-09T09:00:00.000Z")],
      known,
      new Date("2026-09-09T12:00:00.000Z"),
    );

    expect(reading.start).toBeUndefined();
    expect(reading.dropped.map((item) => [item.entry.changeName, item.reason]))
      .toEqual([["deleted-experiment", "deleted"]]);
  });

  it("drops a change that was archived after being scheduled, as archived", () => {
    // a-schedule-keeps-its-promise. The prefix match used to make this
    // the alive case: the entry was promoted to a start, both hosts
    // removed it, and then looked the change up under a name no
    // directory had. A chain does not run against an archived change —
    // its work is done — so this is a drop, and one that says why.
    const reading = readSchedule(
      [entry("old", "2026-09-09T09:00:00.000Z")],
      known,
      new Date("2026-09-09T12:00:00.000Z"),
    );

    expect(reading.start).toBeUndefined();
    expect(reading.dropped.map((item) => item.reason)).toEqual(["archived"]);
    expect(describeDrop(reading.dropped[0]!)).toContain("archived");
  });

  it("starts a due run standing behind an archived entry, on the same reading", () => {
    // The archived entry used to be promoted to the start, so the run
    // genuinely due behind it waited an extra tick for no reason.
    const reading = readSchedule(
      [entry("old", "2026-09-09T08:00:00.000Z"), entry("demo", "2026-09-09T09:00:00.000Z")],
      known,
      new Date("2026-09-09T12:00:00.000Z"),
    );

    expect(reading.start?.entry.changeName).toBe("demo");
    expect(reading.dropped.map((item) => item.entry.changeName)).toEqual(["old"]);
  });

  it("drops a time it cannot read rather than keeping a permanent pending", () => {
    const reading = readSchedule([entry("demo", "not a time")], known, new Date("2026-09-09T12:00:00.000Z"));

    expect(reading.dropped.map((item) => item.reason)).toEqual(["unreadable-time"]);
    expect(reading.pending).toEqual([]);
  });
});

describe("planScheduleFiring", () => {
  // a-schedule-keeps-its-promise, task 1.2. The read-drop-write-pick-
  // remove loop was written twice, once per host, and had already
  // diverged. It is decided here and nowhere else.
  const now = new Date("2026-09-09T12:00:00.000Z");

  it("leaves the started entry out of what is written back and keeps the waiting ones", () => {
    const due = entry("demo", "2026-09-09T09:00:00.000Z");
    const later = entry("other", "2026-09-09T11:00:00.000Z");
    const notYet = entry("demo", "2026-09-09T18:00:00.000Z");

    const firing = planScheduleFiring([due, later, notYet], known, now);

    expect(firing.start?.entry).toEqual(due);
    expect(firing.remaining).toEqual([later, notYet]);
    expect(firing.waitingCount).toBe(1);
    expect(firing.startNote).toContain("1 more scheduled run(s) are still waiting");
  });

  it("keeps the starting entry in what is written after the drops", () => {
    // An entry is consumed only once its run has been opened, so a host
    // that drops first and fails to open still has the run.
    const due = entry("demo", "2026-09-09T09:00:00.000Z");
    const gone = entry("deleted-experiment", "2026-09-09T09:00:00.000Z");

    const firing = planScheduleFiring([gone, due], known, now);

    expect(firing.afterDrops).toEqual([due]);
    expect(firing.remaining).toEqual([]);
    expect(firing.dropNotes).toHaveLength(1);
  });

  it("says nothing about a start when nothing is due", () => {
    const firing = planScheduleFiring([entry("demo", "2026-09-09T18:00:00.000Z")], known, now);

    expect(firing.start).toBeUndefined();
    expect(firing.startNote).toBeUndefined();
    expect(firing.remaining).toHaveLength(1);
  });
});

describe("describePathNoLongerOffered", () => {
  it("names the path and asks for a choice", () => {
    expect(describePathNoLongerOffered("vscode-agent")).toContain("vscode-agent");
    expect(describePathNoLongerOffered("vscode-agent")).toContain("choose one");
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

describe("describeScheduledRunProblem", () => {
  // a-name-is-checked-before-it-is-used, task 2. One rule for the route
  // that writes and the reader that filters: an entry accepted with a
  // 200 and then discarded on the next read makes the response and the
  // file disagree.
  it("accepts an entry the reader would hand back", () => {
    expect(describeScheduledRunProblem(entry("demo", "2026-09-09T18:00:00.000Z"))).toBeUndefined();
    expect(isScheduledRun(entry("demo", "2026-09-09T18:00:00.000Z"))).toBe(true);
  });

  it("names the field that is wrong, rather than saying only that something is", () => {
    expect(describeScheduledRunProblem({ ...entry("demo", "2026-09-09T18:00:00.000Z"), changeName: 5 }))
      .toMatch(/^changeName /u);
    expect(describeScheduledRunProblem({ ...entry("demo", "2026-09-09T18:00:00.000Z"), path: "sideways" }))
      .toMatch(/^path /u);
    expect(describeScheduledRunProblem({ ...entry("demo", "2026-09-09T18:00:00.000Z"), startAt: "tomorrow-ish" }))
      .toMatch(/^startAt /u);
    expect(describeScheduledRunProblem({ ...entry("demo", "2026-09-09T18:00:00.000Z"), requestedAt: "whenever" }))
      .toMatch(/^requestedAt /u);
  });

  it("refuses a change name that could not be a change", () => {
    // The entry is stored and later started, so the name is one that
    // will be joined into a path.
    expect(describeScheduledRunProblem(entry("../../escaped", "2026-09-09T18:00:00.000Z")))
      .toMatch(/is not a valid change name/u);
  });

  it("refuses something that is not an entry at all", () => {
    expect(describeScheduledRunProblem(null)).toBeDefined();
    expect(describeScheduledRunProblem("chain")).toBeDefined();
    expect(isScheduledRun(undefined)).toBe(false);
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
