import { describe, expect, it } from "vitest";
import {
  changeOwnership,
  changeOwnerships,
  changesOnlyElsewhere,
  describeOwnership,
  isOursToWrite,
  ownChangeOf,
  refuseToWrite,
} from "./change-ownership.js";
import type { SurveyedDirectory, SurveyedRun, WorktreeSurvey } from "./worktree-survey-facts.js";

// changes-shows-one-change-and-who-owns-it: pure over one survey.

function run(partial: Partial<SurveyedRun> = {}): SurveyedRun {
  return {
    instanceId: "i1",
    changeName: "demo",
    stage: null,
    activity: "working",
    activitySinceMs: 0,
    heartbeatAgeMs: 0,
    activityAt: "2026-09-20T12:00:00.000Z",
    heartbeatAt: "2026-09-20T12:00:00.000Z",
    gone: false,
    workingDirectory: "/wt/demo",
    runId: null,
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
    branch: "main",
    runs: [],
    readable: true,
    changes: [],
    authorDiffers: false,
    ...partial,
  };
}

function survey(directories: SurveyedDirectory[]): WorktreeSurvey {
  return { directories, runsElsewhere: [] };
}

const elsewhere = (runs: SurveyedRun[] = []): WorktreeSurvey => survey([
  directory(),
  directory({ path: "/wt/demo", label: "demo-worktree", isMain: false, isThis: false, branch: "demo", belongsTo: "demo", runs }),
]);

describe("changeOwnership", () => {
  it("says a change is this directory's when this directory is its worktree", () => {
    const here = survey([
      directory({ path: "/wt/demo", label: "demo-worktree", isMain: false, isThis: true, branch: "demo", belongsTo: "demo" }),
    ]);
    expect(changeOwnership("demo", here)).toEqual({ kind: "here" });
    expect(describeOwnership(changeOwnership("demo", here))).toBeUndefined();
  });

  it("names the directory and the person a verified record gives", () => {
    const ownership = changeOwnership("demo", elsewhere([
      run({ signature: "verified", person: { keyId: "k1", label: "DW" } }),
    ]));
    expect(ownership).toEqual({ kind: "elsewhere", label: "demo-worktree", path: "/wt/demo", branch: "demo", person: "DW" });
    expect(describeOwnership(ownership)).toBe("worked in demo-worktree, by DW");
  });

  it("names the directory and no person where no record names one", () => {
    const ownership = changeOwnership("demo", elsewhere([run()]));
    expect(ownership).toEqual({ kind: "elsewhere", label: "demo-worktree", path: "/wt/demo", branch: "demo" });
    expect(describeOwnership(ownership)).toBe("worked in demo-worktree");
  });

  it("names nobody where a record does not check out", () => {
    const ownership = changeOwnership("demo", elsewhere([
      run({ signature: "verified", person: { keyId: "k1", label: "DW" } }),
      run({ instanceId: "i2", signature: "does-not-check-out" }),
    ]));
    expect(ownership).toEqual({ kind: "unverified", label: "demo-worktree", path: "/wt/demo", branch: "demo" });
    expect(describeOwnership(ownership)).toBe("worked in demo-worktree, by a record that does not check out");
  });

  it("ignores a record whose writer is gone", () => {
    const ownership = changeOwnership("demo", elsewhere([
      run({ signature: "does-not-check-out", gone: true }),
    ]));
    expect(ownership.kind).toBe("elsewhere");
  });

  it("names no person where two live records disagree", () => {
    const ownership = changeOwnership("demo", elsewhere([
      run({ signature: "verified", person: { keyId: "k1", label: "DW" } }),
      run({ instanceId: "i2", signature: "verified", person: { keyId: "k2", label: "Claude" } }),
    ]));
    expect(ownership).toEqual({ kind: "elsewhere", label: "demo-worktree", path: "/wt/demo", branch: "demo" });
  });

  it("says nobody has taken up a change no directory is the worktree of", () => {
    expect(changeOwnership("other", elsewhere())).toEqual({ kind: "nobody" });
    // No caption: in a repository worked in one directory every row would
    // carry the same words, and a caption every row carries is not read.
    expect(describeOwnership({ kind: "nobody" })).toBeUndefined();
  });

  it("says nobody, rather than failing, where no survey could be taken", () => {
    expect(changeOwnership("demo", undefined)).toEqual({ kind: "nobody" });
  });

  it("pairs every name in one pass", () => {
    const all = changeOwnerships(["demo", "other"], elsewhere());
    expect([...all.keys()]).toEqual(["demo", "other"]);
    expect(all.get("other")).toEqual({ kind: "nobody" });
  });
});

// A change proposed this morning is not on the default branch yet, so the
// survey's own pairing does not hold for it - and its directory would read
// as nobody's on the morning the question matters most. Found by looking
// at this repository on 2026-09-20.
describe("a change that is not on the default branch yet", () => {
  const notOnMain = (isThis: boolean): WorktreeSurvey => survey([
    // The main directory is not the one the reading is taken from here.
    directory({ isThis: !isThis }),
    directory({
      path: "/wt/fresh",
      label: "fresh",
      isMain: false,
      isThis,
      branch: "fresh-change",
      changes: [{ changeName: "fresh-change", tasksDone: 0, tasksTotal: 3, blockers: [], alsoIn: [] }],
    }),
  ]);

  it("is this directory's own when its branch bears the name and it holds the change", () => {
    expect(changeOwnership("fresh-change", notOnMain(true))).toEqual({ kind: "here" });
    expect(ownChangeOf(notOnMain(true))).toBe("fresh-change");
  });

  it("is another directory's when that directory's branch bears the name", () => {
    expect(changeOwnership("fresh-change", notOnMain(false)))
      .toEqual({ kind: "elsewhere", label: "fresh", path: "/wt/fresh", branch: "fresh-change" });
  });

  it("is nobody's where the branch bears the name but the change is not there", () => {
    const empty = survey([
      directory(),
      directory({ path: "/wt/fresh", label: "fresh", isMain: false, isThis: false, branch: "fresh-change" }),
    ]);
    expect(changeOwnership("fresh-change", empty)).toEqual({ kind: "nobody" });
  });

  it("is counted among the changes worked only elsewhere", () => {
    const found = changesOnlyElsewhere(notOnMain(false), new Set(["something-else"]));
    expect(found).toEqual([{ changeName: "fresh-change", label: "fresh", path: "/wt/fresh" }]);
  });
});

describe("the change this working directory is working", () => {
  it("is the one the survey paired it with", () => {
    const here = survey([
      directory({ path: "/wt/demo", label: "demo", isMain: false, isThis: true, branch: "demo", belongsTo: "demo" }),
    ]);
    expect(ownChangeOf(here)).toBe("demo");
  });

  it("is nothing in a directory that works none, and nothing without a survey", () => {
    expect(ownChangeOf(survey([directory()]))).toBeUndefined();
    expect(ownChangeOf(undefined)).toBeUndefined();
  });
});

describe("what this checkout may write", () => {
  it("offers its own change and one nobody has taken up", () => {
    expect(isOursToWrite({ kind: "here" })).toBe(true);
    expect(isOursToWrite({ kind: "nobody" })).toBe(true);
    expect(refuseToWrite("demo", { kind: "here" })).toBeUndefined();
  });

  it("refuses another directory's change, and says where to work instead", () => {
    const refusal = refuseToWrite("demo", changeOwnership("demo", elsewhere()));
    expect(refusal).toContain("demo-worktree");
    expect(refusal).toContain("/wt/demo");
    expect(refusal).toContain("Work on it there");
  });

  it("refuses a directory whose record does not check out too", () => {
    const ownership = changeOwnership("demo", elsewhere([run({ signature: "does-not-check-out" })]));
    expect(isOursToWrite(ownership)).toBe(false);
    expect(refuseToWrite("demo", ownership)).toContain("demo-worktree");
  });
});
