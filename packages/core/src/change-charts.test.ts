import { describe, expect, it } from "vitest";
import {
  archivedPerDay,
  describeBasis,
  describeWorkDurationNotCharted,
  leadTimes,
} from "./change-charts.js";
import { readDatedFact, NO_DATE, type DatedFact } from "./change-dates.js";
import type { ChangeTimeline } from "./change-timeline.js";

// charts-over-what-happened, moved to core by
// a-date-is-one-day-in-every-source:
// pure over in-memory timelines — no host, no dates read from anywhere.

function fact(
  recorded: string | undefined,
  source: "git-commit" | "folder-name" | "none",
  dayAsRecorded?: string,
): DatedFact {
  return recorded === undefined ? NO_DATE : readDatedFact(recorded, source, dayAsRecorded);
}

function change(options: {
  name: string;
  archived?: boolean;
  proposed?: [string, "git-commit" | "none"];
  archivedAt?: [string, "git-commit" | "folder-name" | "none"];
  firstWorked?: string;
  unreadableArchiveLines?: number;
}): ChangeTimeline {
  const proposed = fact(options.proposed?.[0], options.proposed?.[1] ?? "none");
  const archived = fact(options.archivedAt?.[0], options.archivedAt?.[1] ?? "none");
  const firstWorked = fact(options.firstWorked, options.firstWorked ? "git-commit" : "none");
  return {
    changeName: options.name,
    archived: options.archived ?? true,
    dates: {
      proposed,
      firstWorked,
      lastWorked: firstWorked,
      archived,
    },
    createdDate: proposed.date,
    archivedDate: archived.day,
    proposal: "",
    design: "",
    specs: [],
    tasks: [],
    ...(options.unreadableArchiveLines
      ? { archiveDatesUnreadableLines: options.unreadableArchiveLines }
      : {}),
  };
}

describe("archivedPerDay", () => {
  it("keeps a quiet day as a zero rather than dropping the column", () => {
    // A chart that skips empty days compresses time, and a quiet week
    // ends up looking like a busy one.
    const result = archivedPerDay([
      change({ name: "a", archivedAt: ["2026-09-01T10:00:00.000Z", "git-commit"] }),
      change({ name: "b", archivedAt: ["2026-09-03T10:00:00.000Z", "git-commit"] }),
      change({ name: "c", archivedAt: ["2026-09-03T18:00:00.000Z", "git-commit"] }),
    ]);

    expect(result.days).toEqual([
      { day: "2026-09-01", count: 1 },
      { day: "2026-09-02", count: 0 },
      { day: "2026-09-03", count: 2 },
    ]);
  });

  it("counts an early-morning archive on the day its own record names", () => {
    // a-date-is-one-day-in-every-source: normalised to UTC this commit
    // is the 26th at 23:30, and the folder that same command named says
    // the 27th. The column is the day the person who archived it would
    // give.
    const result = archivedPerDay([
      change({ name: "commit", archivedAt: ["2026-08-27T02:30:00+03:00", "git-commit"] }),
      change({ name: "folder", archivedAt: ["2026-08-27T00:00:00.000Z", "folder-name"] }),
    ]);

    expect(result.days).toEqual([{ day: "2026-08-27", count: 2 }]);
  });

  it("excludes a change with no archived date, and counts it", () => {
    // "Nothing to plot here" and "nothing happened here" are different
    // facts, and a chart that drops one silently reports the other.
    const result = archivedPerDay([
      change({ name: "dated", archivedAt: ["2026-09-01T10:00:00.000Z", "git-commit"] }),
      change({ name: "moved-by-hand" }),
    ]);

    expect(result.basis.drawn).toBe(1);
    expect(result.basis.excluded).toBe(1);
    expect(result.basis.unreadable).toBeUndefined();
  });

  it("counts an unreadable date apart from one that was never there", () => {
    // A folder prefix with a typo in it is a defect in the record, not
    // a gap in it, and only the first is something a person can fix.
    const unreadable = change({ name: "2026-13-01-typo" });
    unreadable.dates.archived = { date: null, day: null, source: "unreadable" };
    const result = archivedPerDay([unreadable, change({ name: "moved-by-hand" })]);

    expect(result.basis.excluded).toBe(2);
    expect(result.basis.unreadable).toBe(1);
  });

  it("counts a folder-name date apart from a commit one", () => {
    const result = archivedPerDay([
      change({ name: "a", archivedAt: ["2026-09-01T10:00:00.000Z", "git-commit"] }),
      change({ name: "b", archivedAt: ["2026-09-01T00:00:00.000Z", "folder-name"] }),
    ]);

    expect(result.basis.bySource).toEqual({ "git-commit": 1, "folder-name": 1 });
  });

  it("draws nothing for a set with nothing archived", () => {
    const result = archivedPerDay([change({ name: "active", archived: false })]);

    expect(result.days).toEqual([]);
    expect(result.basis.drawn).toBe(0);
  });

  it("carries the archive read's unread lines into the basis", () => {
    // A batch read that fell short sends every affected change to the
    // slow per-change call. It was silent; the basis line says it now.
    const result = archivedPerDay([
      change({
        name: "a",
        archivedAt: ["2026-09-01T10:00:00.000Z", "git-commit"],
        unreadableArchiveLines: 3,
      }),
    ]);

    expect(result.basis.unreadableArchiveLines).toBe(3);
  });
});

describe("leadTimes", () => {
  function span(from: string, to: string) {
    return change({
      name: `${from}->${to}`,
      proposed: [from, "git-commit"],
      archivedAt: [to, "git-commit"],
    });
  }

  it("puts each span in the bucket its boundaries name", () => {
    const result = leadTimes([
      span("2026-09-01T10:00:00.000Z", "2026-09-01T18:00:00.000Z"),
      span("2026-09-01T10:00:00.000Z", "2026-09-02T11:00:00.000Z"),
      span("2026-09-01T10:00:00.000Z", "2026-09-03T11:00:00.000Z"),
      span("2026-09-01T10:00:00.000Z", "2026-09-08T09:00:00.000Z"),
      span("2026-09-01T10:00:00.000Z", "2026-09-20T09:00:00.000Z"),
    ]);

    expect(result.buckets).toEqual([
      { label: "Under a day", count: 1 },
      { label: "1–2 days", count: 1 },
      { label: "2–3 days", count: 1 },
      { label: "3–8 days", count: 1 },
      { label: "8 days or more", count: 1 },
    ]);
  });

  it("calls sixteen hours across midnight what it is, not a same day", () => {
    // The bucket used to be named "Same day" for a floor of twenty-four
    // hours, which is a claim about the calendar the arithmetic never
    // made.
    const result = leadTimes([span("2026-09-01T22:00:00.000Z", "2026-09-02T14:00:00.000Z")]);

    expect(result.buckets[0]).toEqual({ label: "Under a day", count: 1 });
  });

  it("excludes a span that would be measured from a date it does not have", () => {
    const result = leadTimes([
      change({ name: "no-proposal", archivedAt: ["2026-09-02T10:00:00.000Z", "git-commit"] }),
    ]);

    expect(result.basis.drawn).toBe(0);
    expect(result.basis.excluded).toBe(1);
  });

  it("rests a span on the weaker of its two sources", () => {
    // A span between a commit and a folder name is only as good as the
    // folder name.
    const result = leadTimes([
      change({
        name: "mixed",
        proposed: ["2026-09-01T10:00:00.000Z", "git-commit"],
        archivedAt: ["2026-09-03T00:00:00.000Z", "folder-name"],
      }),
    ]);

    expect(result.basis.bySource).toEqual({ "folder-name": 1 });
  });
});

describe("describeBasis", () => {
  it("says what was drawn, from where, and what was left out", () => {
    expect(describeBasis({ drawn: 178, excluded: 7, bySource: { "git-commit": 176, "folder-name": 2 } }))
      .toBe("178 changes · 176 dated from a commit · 2 from a folder name · 7 left out for having no date.");
  });

  it("says there is nothing yet rather than reporting zeroes", () => {
    expect(describeBasis({ drawn: 0, excluded: 0, bySource: {} })).toBe("Nothing to draw yet.");
  });

  it("says when the archive read fell short", () => {
    expect(describeBasis({
      drawn: 2,
      excluded: 0,
      bySource: { "git-commit": 2 },
      unreadableArchiveLines: 4,
    })).toBe(
      "2 changes · 2 dated from a commit. 4 archive log lines were unreadable; those dates were read one change at a time.",
    );
  });

  it("says how many of the left-out dates were unreadable rather than absent", () => {
    expect(describeBasis({ drawn: 3, excluded: 2, unreadable: 1, bySource: { "git-commit": 3 } }))
      .toBe("3 changes · 3 dated from a commit · 2 left out for having no date, 1 of them unreadable.");
  });
});

describe("describeWorkDurationNotCharted", () => {
  it("counts the flat changes in the workspace it is shown for", () => {
    // The sentence used to be a constant reading "measured over this
    // repository, 135 of 185 changes…", rendered to every workspace.
    const sentence = describeWorkDurationNotCharted([
      change({ name: "flat", proposed: ["2026-09-01T10:00:00.000Z", "git-commit"], firstWorked: "2026-09-01T18:00:00.000Z" }),
      change({ name: "flat-too", proposed: ["2026-09-02T10:00:00.000Z", "git-commit"], firstWorked: "2026-09-02T11:00:00.000Z" }),
      change({ name: "not-flat", proposed: ["2026-09-01T10:00:00.000Z", "git-commit"], firstWorked: "2026-09-04T11:00:00.000Z" }),
    ]);

    expect(sentence).toContain("2 of 3 changes have exactly zero days");
    expect(sentence).toContain("50%");
    expect(sentence).not.toContain("this repository");
  });

  it("says there is nothing to measure between when nothing carries both dates", () => {
    const sentence = describeWorkDurationNotCharted([change({ name: "bare" })]);

    expect(sentence).toContain("no change here carries both a proposal date and a finished task");
  });

  it("says the figure is under the threshold when it is", () => {
    const sentence = describeWorkDurationNotCharted([
      change({ name: "a", proposed: ["2026-09-01T10:00:00.000Z", "git-commit"], firstWorked: "2026-09-03T11:00:00.000Z" }),
      change({ name: "b", proposed: ["2026-09-01T10:00:00.000Z", "git-commit"], firstWorked: "2026-09-04T11:00:00.000Z" }),
      change({ name: "c", proposed: ["2026-09-01T10:00:00.000Z", "git-commit"], firstWorked: "2026-09-01T11:00:00.000Z" }),
    ]);

    expect(sentence).toContain("1 of 3 changes have exactly zero days");
    expect(sentence).toContain("under the 50%");
  });
});
