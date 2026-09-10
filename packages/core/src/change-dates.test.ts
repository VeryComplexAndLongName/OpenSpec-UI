import { describe, expect, it } from "vitest";
import { buildChangeDates, readDatedFact, withoutArchivePrefix } from "./change-dates.js";

// change-dates-from-evidence:
// pure over in-memory evidence — no git, no filesystem.

describe("buildChangeDates", () => {
  it("dates the archiving from the commit that archived it", () => {
    const dates = buildChangeDates({
      changeName: "2026-09-09-presets-by-effort",
      archived: true,
      proposalAddedDate: "2026-09-09T09:28:54.000Z",
      archiveCommitDate: "2026-09-09T11:22:19.000Z",
    });

    expect(dates.archived)
      .toEqual({ date: "2026-09-09T11:22:19.000Z", day: "2026-09-09", source: "git-commit" });
    // Not the archive commit: `--follow` is what keeps the rename from
    // resetting when the change was proposed.
    expect(dates.proposed)
      .toEqual({ date: "2026-09-09T09:28:54.000Z", day: "2026-09-09", source: "git-commit" });
  });

  it("gives an after-midnight commit and the folder it named the same day", () => {
    // a-date-is-one-day-in-every-source, 1.3. `2026-08-27-add-stale-
    // task-detection` was archived by a commit at 02:30 +03:00 on the
    // 27th; normalised, that is the 26th at 23:30 UTC, and the field
    // read `2026-08-26` while the folder said the 27th. Two sources
    // disagreeing about one action.
    const fromCommit = buildChangeDates({
      changeName: "2026-08-27-add-stale-task-detection",
      archived: true,
      archiveCommitDate: "2026-08-27T02:30:00+03:00",
    });

    expect(fromCommit.archived.day).toBe("2026-08-27");
    // The instant is kept, normalised, because that is what orders and
    // subtracts. Only the day changes meaning.
    expect(fromCommit.archived.date).toBe("2026-08-26T23:30:00.000Z");

    const fromFolder = buildChangeDates({
      changeName: "2026-08-27-add-stale-task-detection",
      archived: true,
      archiveCommitDate: null,
    });

    expect(fromFolder.archived.day).toBe("2026-08-27");
    expect(fromFolder.archived.source).toBe("folder-name");
  });

  it("falls back to the folder name, and says that is what it did", () => {
    // A chart that cannot tell this from the case above would be
    // treating a naming convention as a measurement.
    const dates = buildChangeDates({
      changeName: "2026-09-01-something-old",
      archived: true,
      archiveCommitDate: null,
    });

    expect(dates.archived)
      .toEqual({ date: "2026-09-01T00:00:00.000Z", day: "2026-09-01", source: "folder-name" });
  });

  it("reports no archived date when there is neither a commit nor a prefix", () => {
    // A change archived by moving the directory by hand. Absent is
    // honest; today's date would be believed because it looks computed.
    const dates = buildChangeDates({
      changeName: "moved-by-hand",
      archived: true,
      archiveCommitDate: null,
    });

    expect(dates.archived).toEqual({ date: null, day: null, source: "none" });
  });

  it("reports a prefix shaped like a date that is not one as unreadable", () => {
    // a-date-is-one-day-in-every-source, 3.1/3.2. `new Date(
    // "2026-13-01T00:00:00.000Z").toISOString()` throws, and it threw
    // through here and out of the whole multi-change request. Absent
    // and saying why beats failing every other change's dates.
    const dates = buildChangeDates({
      changeName: "2026-13-01-typo",
      archived: true,
      archiveCommitDate: null,
    });

    expect(dates.archived).toEqual({ date: null, day: null, source: "unreadable" });
  });

  it("never throws on evidence no date can be read from", () => {
    // The module header has always promised this; it is kept by one
    // parse rather than by every caller remembering.
    expect(() => buildChangeDates({
      changeName: "torn-record",
      archived: true,
      proposalAddedDate: "not a date at all",
      archiveCommitDate: "2026-02-30T99:99:99Z",
      taskDoneDates: ["", "nonsense"],
      auditTimestamps: ["also nonsense"],
    })).not.toThrow();

    const dates = buildChangeDates({
      changeName: "torn-record",
      archived: true,
      proposalAddedDate: "not a date at all",
      archiveCommitDate: null,
      taskDoneDates: ["nonsense"],
    });

    expect(dates.proposed.source).toBe("unreadable");
    expect(dates.firstWorked.source).toBe("unreadable");
  });

  it("reports no archived date for a change that is not archived", () => {
    const dates = buildChangeDates({ changeName: "2026-09-09-looks-dated", archived: false });

    expect(dates.archived.date).toBeNull();
  });

  it("reports no proposed date for a change nobody has committed", () => {
    const dates = buildChangeDates({ changeName: "only-in-the-working-tree", archived: false });

    expect(dates.proposed).toEqual({ date: null, day: null, source: "none" });
  });

  it("spans the work from the earliest to the latest evidence of it", () => {
    // Ticked tasks, not written lines: the task list arrives in the same
    // commit as the proposal, so dating work by when its lines were
    // written reported the proposal date under another name — measured
    // at exactly zero days for all 185 changes here.
    const dates = buildChangeDates({
      changeName: "worked-over-days",
      archived: false,
      proposalAddedDate: "2026-09-01T10:00:00.000Z",
      taskDoneDates: [
        "2026-09-03T12:00:00.000Z",
        "2026-09-02T08:00:00.000Z",
        "2026-09-05T18:00:00.000Z",
      ],
    });

    expect(dates.firstWorked)
      .toEqual({ date: "2026-09-02T08:00:00.000Z", day: "2026-09-02", source: "git-blame" });
    expect(dates.lastWorked)
      .toEqual({ date: "2026-09-05T18:00:00.000Z", day: "2026-09-05", source: "git-blame" });
  });

  it("takes whichever evidence is earlier, and says which kind it was", () => {
    // Blame and the audit log are one set rather than a preference:
    // whichever is earlier is when work started, whoever recorded it.
    const dates = buildChangeDates({
      changeName: "run-before-a-tick",
      archived: false,
      taskDoneDates: ["2026-09-04T00:00:00.000Z"],
      auditTimestamps: ["2026-09-02T05:15:15.572Z", "2026-09-02T06:12:01.274Z"],
    });

    expect(dates.firstWorked)
      .toEqual({ date: "2026-09-02T05:15:15.572Z", day: "2026-09-02", source: "audit-log" });
    expect(dates.lastWorked)
      .toEqual({ date: "2026-09-04T00:00:00.000Z", day: "2026-09-04", source: "git-blame" });
  });

  it("keeps the readable ticks when one of them is torn", () => {
    // One unreadable line among good ones does not make when the work
    // happened unknown.
    const dates = buildChangeDates({
      changeName: "one-torn-line",
      archived: false,
      taskDoneDates: ["nonsense", "2026-09-04T00:00:00.000Z"],
    });

    expect(dates.firstWorked.date).toBe("2026-09-04T00:00:00.000Z");
  });

  it("reports no work dates when a task list was written but nothing was finished", () => {
    // The file existing is not evidence that anything was done.
    const dates = buildChangeDates({ changeName: "nothing-yet", archived: false, taskDoneDates: [] });

    expect(dates.firstWorked).toEqual({ date: null, day: null, source: "none" });
    expect(dates.lastWorked).toEqual({ date: null, day: null, source: "none" });
  });
});

describe("readDatedFact", () => {
  it("reads the day from the record rather than from the normalised instant", () => {
    expect(readDatedFact("2026-08-27T02:30:00+03:00", "git-commit"))
      .toEqual({ date: "2026-08-26T23:30:00.000Z", day: "2026-08-27", source: "git-commit" });
  });

  it("takes the day it is given for a source that has a day and no instant", () => {
    expect(readDatedFact("2026-09-01T00:00:00.000Z", "folder-name", "2026-09-01").day)
      .toBe("2026-09-01");
  });

  it("returns absent for nothing, and unreadable for something that is not a date", () => {
    expect(readDatedFact(null, "git-commit").source).toBe("none");
    expect(readDatedFact("", "git-commit").source).toBe("none");
    expect(readDatedFact("2026-13-01T00:00:00.000Z", "folder-name", "2026-13-01").source)
      .toBe("unreadable");
  });
});

describe("withoutArchivePrefix", () => {
  it("gives back the name a change had while it was active", () => {
    expect(withoutArchivePrefix("2026-09-09-presets-by-effort")).toBe("presets-by-effort");
  });

  it("leaves a name with no prefix alone", () => {
    expect(withoutArchivePrefix("presets-by-effort")).toBe("presets-by-effort");
  });
});
