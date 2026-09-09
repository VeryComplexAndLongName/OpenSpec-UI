import { describe, expect, it } from "vitest";
import { buildChangeDates } from "./change-dates.js";

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

    expect(dates.archived).toEqual({ date: "2026-09-09T11:22:19.000Z", source: "git-commit" });
    // Not the archive commit: `--follow` is what keeps the rename from
    // resetting when the change was proposed.
    expect(dates.proposed).toEqual({ date: "2026-09-09T09:28:54.000Z", source: "git-commit" });
  });

  it("falls back to the folder name, and says that is what it did", () => {
    // A chart that cannot tell this from the case above would be
    // treating a naming convention as a measurement.
    const dates = buildChangeDates({
      changeName: "2026-09-01-something-old",
      archived: true,
      archiveCommitDate: null,
    });

    expect(dates.archived).toEqual({ date: "2026-09-01T00:00:00.000Z", source: "folder-name" });
  });

  it("reports no archived date when there is neither a commit nor a prefix", () => {
    // A change archived by moving the directory by hand. Absent is
    // honest; today's date would be believed because it looks computed.
    const dates = buildChangeDates({
      changeName: "moved-by-hand",
      archived: true,
      archiveCommitDate: null,
    });

    expect(dates.archived).toEqual({ date: null, source: "none" });
  });

  it("reports no archived date for a change that is not archived", () => {
    const dates = buildChangeDates({ changeName: "2026-09-09-looks-dated", archived: false });

    expect(dates.archived.date).toBeNull();
  });

  it("reports no proposed date for a change nobody has committed", () => {
    const dates = buildChangeDates({ changeName: "only-in-the-working-tree", archived: false });

    expect(dates.proposed).toEqual({ date: null, source: "none" });
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

    expect(dates.firstWorked).toEqual({ date: "2026-09-02T08:00:00.000Z", source: "git-blame" });
    expect(dates.lastWorked).toEqual({ date: "2026-09-05T18:00:00.000Z", source: "git-blame" });
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

    expect(dates.firstWorked).toEqual({ date: "2026-09-02T05:15:15.572Z", source: "audit-log" });
    expect(dates.lastWorked).toEqual({ date: "2026-09-04T00:00:00.000Z", source: "git-blame" });
  });

  it("reports no work dates when a task list was written but nothing was finished", () => {
    // The file existing is not evidence that anything was done.
    const dates = buildChangeDates({ changeName: "nothing-yet", archived: false, taskDoneDates: [] });

    expect(dates.firstWorked).toEqual({ date: null, source: "none" });
    expect(dates.lastWorked).toEqual({ date: null, source: "none" });
  });
});
