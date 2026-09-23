import { describe, expect, it } from "vitest";
import { describeDuration, describeStageLine, describeVisit, playStages, stageFromFiles, totalsOf, type StageFact } from "./change-stage-facts.js";

// a-change-knows-its-stage, ADR 0037 decisions 5 and 6.

const at = (hour: number) => new Date(Date.UTC(2026, 8, 22, hour)).toISOString();
const fact = (stage: StageFact["stage"], hour: number, what = stage): StageFact => ({ stage, at: at(hour), source: "git-commit", what });

describe("playing the facts into stages", () => {
  it("moves forward on each fact that proves a later stage, and never back on a fact", () => {
    const visits = playStages([
      fact("proposed", 1), fact("planned", 2), fact("in-progress", 3), fact("in-progress", 4),
      fact("in-review", 5), fact("in-progress", 6), fact("landed", 7),
    ]);

    expect(visits.map((one) => [one.stage, one.from, one.to])).toEqual([
      ["proposed", at(1), at(2)],
      ["planned", at(2), at(3)],
      ["in-progress", at(3), at(5)],
      ["in-review", at(5), at(7)],
      ["landed", at(7), undefined],
    ]);
  });

  it("moves back on a send-back, and on only newer facts after it", () => {
    const visits = playStages([
      fact("in-progress", 1), fact("in-review", 2),
      { stage: "in-progress", at: at(3), source: "history", what: "ada: a gap", back: true },
      fact("in-progress", 4), fact("in-review", 5),
    ]);

    expect(visits.map((one) => [one.stage, one.from])).toEqual([
      ["in-progress", at(1)], ["in-review", at(2)], ["in-progress", at(3)], ["in-review", at(5)],
    ]);
  });

  it("takes a fact before a send-back at the same instant", () => {
    const visits = playStages([
      { stage: "planned", at: at(1), source: "history", what: "back", back: true },
      fact("in-review", 1),
    ]);

    expect(visits.map((one) => one.stage)).toEqual(["in-review", "planned"]);
  });

  it("counts the time in each stage over every visit, the current one up to now", () => {
    const visits = playStages([
      fact("in-progress", 0), fact("in-review", 2),
      { stage: "in-progress", at: at(3), source: "history", what: "back", back: true },
      fact("in-review", 6),
    ]);

    expect(totalsOf(visits, new Date(at(10)))).toEqual([
      { stage: "in-progress", visits: 2, ms: 5 * 3_600_000 },
      { stage: "in-review", visits: 2, ms: 5 * 3_600_000 },
    ]);
  });
});

describe("the words", () => {
  it("says a duration short, and a visit with what began it", () => {
    expect(describeDuration(30_000)).toBe("under a minute");
    expect(describeDuration(12 * 60_000)).toBe("12m");
    expect(describeDuration(125 * 60_000)).toBe("2h 5m");
    expect(describeDuration((3 * 24 + 4) * 3_600_000)).toBe("3d 4h");
    const [visit] = playStages([{ stage: "planned", at: at(1), source: "history", what: "ada: scope grew", back: true }]);
    expect(describeVisit(visit!, new Date(at(3)))).toBe(`Planned, ${at(1)} to now, 2h (sent back: ada: scope grew)`);
  });

  it("reads a stage from the files where nothing dates one", () => {
    expect(stageFromFiles({ total: 0, done: 0 })).toBe("proposed");
    expect(stageFromFiles({ total: 3, done: 0 })).toBe("planned");
    expect(stageFromFiles({ total: 3, done: 1 })).toBe("in-progress");
  });
});

// the-board-shows-the-stages: one line per card, and no line filled with
// what nobody is.
describe("where a change is, on a card", () => {
  const summary = (roles: { owner?: string; implementer?: string }) => ({
    changeName: "demo",
    stage: "in-review" as const,
    since: at(6),
    roles,
    totals: [],
  });

  it("says the stage, how long, and whoever holds it", () => {
    expect(describeStageLine(summary({ owner: "ada", implementer: "bob" }), new Date(at(10))))
      .toBe("In review for 4h, ada owns it, bob implements it");
    expect(describeStageLine(summary({ owner: "ada" }), new Date(at(10)))).toBe("In review for 4h, ada owns it");
    expect(describeStageLine(summary({}), new Date(at(10)))).toBe("In review for 4h");
  });

  it("says only the stage where nothing dates it", () => {
    expect(describeStageLine({ changeName: "demo", stage: "planned", roles: {}, totals: [] }, new Date(at(10)))).toBe("Planned");
  });
});
