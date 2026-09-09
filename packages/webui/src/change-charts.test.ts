import { describe, expect, it } from "vitest";
import { archivedPerDay, describeBasis, leadTimes } from "./change-charts.js";
import type { ChangeTimeline } from "./change-timeline-client.js";

// charts-over-what-happened:
// pure over in-memory timelines — no host, no dates read from anywhere.

function change(options: {
  name: string;
  archived?: boolean;
  proposed?: [string, "git-commit" | "none"];
  archivedAt?: [string, "git-commit" | "folder-name" | "none"];
}): ChangeTimeline {
  const [proposedDate, proposedSource] = options.proposed ?? [null as unknown as string, "none" as const];
  const [archivedDate, archivedSource] = options.archivedAt ?? [null as unknown as string, "none" as const];
  return {
    changeName: options.name,
    archived: options.archived ?? true,
    dates: {
      proposed: { date: proposedDate ?? null, source: proposedSource },
      firstWorked: { date: null, source: "none" },
      lastWorked: { date: null, source: "none" },
      archived: { date: archivedDate ?? null, source: archivedSource },
    },
    createdDate: proposedDate ?? null,
    archivedDate: archivedDate ? archivedDate.slice(0, 10) : null,
    proposal: "",
    design: "",
    specs: [],
    tasks: [],
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

  it("excludes a change with no archived date, and counts it", () => {
    // "Nothing to plot here" and "nothing happened here" are different
    // facts, and a chart that drops one silently reports the other.
    const result = archivedPerDay([
      change({ name: "dated", archivedAt: ["2026-09-01T10:00:00.000Z", "git-commit"] }),
      change({ name: "moved-by-hand" }),
    ]);

    expect(result.basis.drawn).toBe(1);
    expect(result.basis.excluded).toBe(1);
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
});

describe("leadTimes", () => {
  function span(from: string, to: string) {
    return change({
      name: `${from}->${to}`,
      proposed: [from, "git-commit"],
      archivedAt: [to, "git-commit"],
    });
  }

  it("puts each span in the bucket a person would read it as", () => {
    const result = leadTimes([
      span("2026-09-01T10:00:00.000Z", "2026-09-01T18:00:00.000Z"),
      span("2026-09-01T10:00:00.000Z", "2026-09-02T11:00:00.000Z"),
      span("2026-09-01T10:00:00.000Z", "2026-09-03T11:00:00.000Z"),
      span("2026-09-01T10:00:00.000Z", "2026-09-08T09:00:00.000Z"),
      span("2026-09-01T10:00:00.000Z", "2026-09-20T09:00:00.000Z"),
    ]);

    expect(result.buckets).toEqual([
      { label: "Same day", count: 1 },
      { label: "1 day", count: 1 },
      { label: "2 days", count: 1 },
      { label: "3–7 days", count: 1 },
      { label: "Over a week", count: 1 },
    ]);
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
});
