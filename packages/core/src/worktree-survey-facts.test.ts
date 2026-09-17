import { describe, expect, it } from "vitest";
import type { ChangeStanding } from "./change-standing-facts.js";
import { withSurveyedRuns, type SurveyedDirectory, type SurveyedRun } from "./worktree-survey-facts.js";

// the-changes-views-see-a-run-start 1.2: the one function a card, the
// editor's Changes tree and the standalone Changes list lay runs over
// standings with. Pure over in-memory readings.

function run(partial: Partial<SurveyedRun> = {}): SurveyedRun {
  return {
    instanceId: "i1",
    changeName: "demo",
    stage: "apply",
    activity: "running apply",
    activitySinceMs: 0,
    heartbeatAgeMs: 0,
    activityAt: "2026-09-17T12:00:00.000Z",
    heartbeatAt: "2026-09-17T12:00:00.000Z",
    gone: false,
    workingDirectory: "/repo",
    runId: "r1",
    waiting: null,
    signature: "unverified",
    ...partial,
  };
}

function directory(partial: Partial<Extract<SurveyedDirectory, { readable: true }>> = {}): SurveyedDirectory {
  return {
    path: "/repo",
    label: "repo",
    labelDeclared: false,
    isMain: true,
    isThis: true,
    runs: [],
    readable: true,
    changes: [],
    authorDiffers: false,
    ...partial,
  };
}

/** A standing read before any run started. */
const BEFORE: ChangeStanding = {
  changeName: "demo",
  here: { label: "repo", path: "C:/repo", counts: { done: 1, total: 3 }, runs: [] },
  elsewhere: [{ label: "spare", path: "/wt/spare", runs: [] }],
  main: { kind: "active", counts: { done: 0, total: 3 } },
};

describe("withSurveyedRuns", () => {
  it("gives this checkout's copy the runs of the survey's own directory, whatever its path is spelled as", () => {
    const laid = withSurveyedRuns(BEFORE, { directories: [directory({ runs: [run()] })], runsElsewhere: [] });

    expect(laid.here?.runs).toEqual([{ instanceId: "i1", stage: "apply", waiting: false }]);
    // What else the standing read still stands.
    expect(laid.here?.counts).toEqual({ done: 1, total: 3 });
    expect(laid.main).toEqual({ kind: "active", counts: { done: 0, total: 3 } });
  });

  it("gives a copy elsewhere the runs of the directory at its path, and only its change's live ones", () => {
    const spare = directory({
      path: "/wt/spare",
      label: "spare",
      isMain: false,
      isThis: false,
      runs: [
        run({ instanceId: "i2", workingDirectory: "/wt/spare", waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } }),
        run({ instanceId: "i3", workingDirectory: "/wt/spare", changeName: "other" }),
        run({ instanceId: "i4", workingDirectory: "/wt/spare", gone: true }),
      ],
    });
    const laid = withSurveyedRuns(BEFORE, { directories: [directory(), spare], runsElsewhere: [] });

    expect(laid.elsewhere[0]?.runs).toEqual([{ instanceId: "i2", stage: "apply", waiting: true }]);
    expect(laid.here?.runs).toEqual([]);
  });

  it("keeps a copy's runs where the survey does not list its directory, and the whole standing without a survey", () => {
    const standing: ChangeStanding = {
      changeName: "demo",
      here: { label: "repo", path: "/repo", runs: [] },
      elsewhere: [{ label: "gone", path: "/wt/gone", runs: [{ instanceId: "i9", stage: "verify", waiting: true }] }],
    };

    expect(withSurveyedRuns(standing, { directories: [directory()], runsElsewhere: [] }).elsewhere[0]?.runs)
      .toEqual([{ instanceId: "i9", stage: "verify", waiting: true }]);
    expect(withSurveyedRuns(standing, undefined)).toBe(standing);
  });
});
