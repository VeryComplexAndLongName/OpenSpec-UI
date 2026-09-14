import { describe, expect, it } from "vitest";
import { describeChangeCard, describeChangeCards, runsShownOnCards, type ChangeCard, type ChangeCardInputs } from "./change-card.js";
import type { ChangeReadiness } from "./change-readiness-facts.js";
import type { LastRun } from "./last-runs-facts.js";
import { describeDirectoryRuns, type SurveyedChange, type SurveyedDirectory, type SurveyedRun } from "./worktree-survey-facts.js";

// a-card-says-what-its-change-is-doing: pure over in-memory readings.

const NOW = new Date("2026-09-14T12:00:00.000Z");
const minutesBefore = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

function readiness(run: ChangeReadiness["run"] = { state: "ready" }): ChangeReadiness {
  return { changeName: "demo", run, blockers: [], capabilities: [], canJoin: [], blockedFrom: [] };
}

function change(partial: Partial<SurveyedChange> = {}): SurveyedChange {
  return {
    changeName: "demo",
    tasksDone: 1,
    tasksTotal: 3,
    blockers: [],
    alsoIn: [],
    tasksForPerson: 0,
    tasksDelegated: 0,
    ...partial,
  };
}

function run(partial: Partial<SurveyedRun> = {}): SurveyedRun {
  return {
    instanceId: "i1",
    changeName: "demo",
    stage: "apply",
    activity: "running apply",
    activitySinceMs: 0,
    heartbeatAgeMs: 0,
    activityAt: new Date(NOW.getTime() - 30_000).toISOString(),
    heartbeatAt: NOW.toISOString(),
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
    branch: "main",
    runs: [],
    readable: true,
    changes: [change()],
    authorDiffers: false,
    ...partial,
  };
}

function lastRun(partial: Partial<LastRun> = {}): LastRun {
  return { runId: "c1", outcome: "failed", stage: "verify", endedAt: minutesBefore(120), ...partial };
}

function cardOf(options: {
  run?: ChangeReadiness["run"];
  directories?: SurveyedDirectory[];
  last?: LastRun;
} = {}): ChangeCard {
  const inputs: ChangeCardInputs = {
    report: { changes: [readiness(options.run)] },
    survey: { directories: options.directories ?? [directory()], runsElsewhere: [] },
    ...(options.last !== undefined ? { lastRuns: { byChange: { demo: options.last } } } : {}),
    now: NOW,
  };
  const [card] = describeChangeCards(inputs);
  return card!;
}

describe("describeChangeCards — the state, first match wins", () => {
  it("is waiting for a live run whose record waits, even where a lease says running", () => {
    const card = cardOf({
      run: { state: "running", worktreePath: "/repo" },
      directories: [directory({ runs: [run({ waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } })] })],
      last: lastRun(),
    });
    expect(card.state).toBe("waiting");
    expect(describeChangeCard(card, NOW).stateWords).toBe("Waiting for you");
  });

  it("is running for any other live run", () => {
    const card = cardOf({ directories: [directory({ runs: [run()] })], last: lastRun() });
    expect(card.state).toBe("running");
    expect(describeChangeCard(card, NOW).stateWords).toBe("Running");
  });

  it("is running where readiness says so and no run is surveyed, with no run on the card", () => {
    const card = cardOf({ run: { state: "running", worktreePath: "/repo" } });
    expect(card.state).toBe("running");
    expect(card.run).toBeUndefined();
    expect(describeChangeCard(card, NOW).stateWords).toBe("Running");
  });

  it("does not count a gone run as live", () => {
    const card = cardOf({ directories: [directory({ runs: [run({ gone: true })] })] });
    expect(card.state).toBe("ready");
  });

  it("is failed when the last run failed after the task list last changed", () => {
    const card = cardOf({
      directories: [directory({ changes: [change({ tasksModifiedAt: minutesBefore(180) })] })],
      last: lastRun({ endedAt: minutesBefore(120) }),
    });
    expect(card.state).toBe("failed");
    expect(describeChangeCard(card, NOW).stateWords).toBe("Failed at verify");
  });

  it("is stopped when the last run was cancelled", () => {
    const card = cardOf({ last: lastRun({ outcome: "cancelled" }) });
    expect(card.state).toBe("stopped");
    expect(describeChangeCard(card, NOW).stateWords).toBe("Stopped at verify");
  });

  it("says plainly Failed where the run had no stage", () => {
    const { stage: _stage, ...noStage } = lastRun();
    const card = cardOf({ last: noStage });
    expect(describeChangeCard(card, NOW).stateWords).toBe("Failed");
  });

  it("is not failed by a failure older than the task list", () => {
    const card = cardOf({
      directories: [directory({ changes: [change({ tasksModifiedAt: minutesBefore(60) })] })],
      last: lastRun({ endedAt: minutesBefore(120) }),
    });
    expect(card.state).toBe("ready");
    expect(describeChangeCard(card, NOW).stateWords).toBe("Ready");
    // The run still happened, and the card still says how it ended.
    expect(describeChangeCard(card, NOW).lines).toContain("last run failed at verify 2 hours ago");
  });

  it("is blocked where readiness says so", () => {
    const card = cardOf({ run: { state: "blocked", blockedBy: ["other"] } });
    expect(card.state).toBe("blocked");
    expect(describeChangeCard(card, NOW).stateWords).toBe("Blocked");
  });

  it("is done when every task is done", () => {
    const card = cardOf({ directories: [directory({ changes: [change({ tasksDone: 3, tasksTotal: 3 })] })] });
    expect(card.state).toBe("done");
    expect(describeChangeCard(card, NOW).stateWords).toBe("Done");
  });

  it("is ready otherwise, and a completed last run does not change that", () => {
    const card = cardOf({ last: lastRun({ outcome: "completed", stage: "apply" }) });
    expect(card.state).toBe("ready");
    expect(describeChangeCard(card, NOW).stateWords).toBe("Ready");
  });
});

describe("describeChangeCards — what a card is read from", () => {
  it("takes a change with its own worktree from that worktree, and names it", () => {
    const worktree = directory({
      path: "/wt/demo",
      label: "demo-worktree",
      isMain: false,
      isThis: false,
      branch: "demo",
      belongsTo: "demo",
      changes: [change({ tasksDone: 2, tasksTotal: 3 })],
      runs: [run({ workingDirectory: "/wt/demo", task: { number: "1.2", text: "Wire it", source: "agent" } })],
    });
    const card = cardOf({ directories: [directory({ changes: [change({ tasksDone: 0 })] }), worktree] });

    expect(card.state).toBe("running");
    expect(card.progress).toEqual({ done: 2, total: 3, forPerson: 0, delegated: 0 });
    expect(card.where).toEqual({ label: "demo-worktree", path: "/wt/demo", branch: "demo", ownWorktree: true });
    expect(describeChangeCard(card, NOW).lines).toEqual([
      "on task 1.2: Wire it, by its own account",
      "running apply — said 30s ago",
      "2 of 3 tasks done",
      "in demo-worktree, on branch demo",
    ]);
  });

  it("ignores a run of another change in the same directory", () => {
    const card = cardOf({ directories: [directory({ runs: [run({ changeName: "other" })] })] });
    expect(card.run).toBeUndefined();
    expect(card.state).toBe("ready");
  });
});

describe("runsShownOnCards (5.8)", () => {
  it("names the run a card shows, and a directory's run lines leave it out", () => {
    const here = directory({ runs: [run(), run({ instanceId: "i2", changeName: "other", activity: "reading" })] });
    const cards = describeChangeCards({ report: { changes: [readiness()] }, survey: { directories: [here], runsElsewhere: [] }, now: NOW });

    const shown = runsShownOnCards(cards);
    expect([...shown]).toEqual(["i1"]);
    expect(describeDirectoryRuns(here, NOW, shown)).toEqual([expect.stringContaining("other (apply): reading")]);
  });

  it("says a directory's every run is on a card, rather than that none reports", () => {
    const here = directory({ runs: [run()] });
    const cards = describeChangeCards({ report: { changes: [readiness()] }, survey: { directories: [here], runsElsewhere: [] }, now: NOW });

    expect(describeDirectoryRuns(here, NOW, runsShownOnCards(cards))).toEqual(["every run here is on its change's card"]);
  });
});

describe("describeChangeCard — the lines", () => {
  it("guesses the first open task a run can close where the record names none", () => {
    // The survey's `nextOpenTask` already skips Human-only and delegated
    // items (worktree-survey.test.ts); the card says it is a guess.
    const card = cardOf({
      directories: [directory({
        changes: [change({ tasksForPerson: 1, tasksDelegated: 1, nextOpenTask: { number: "2.4", text: "Write the tests" } })],
        runs: [run()],
      })],
    });
    expect(card.run?.task).toEqual({ number: "2.4", text: "Write the tests", source: "guess" });
    expect(describeChangeCard(card, NOW).lines).toEqual([
      "probably task 2.4: Write the tests",
      "running apply — said 30s ago",
      "1 of 3 tasks done; 1 only a person can close; 1 delegated",
    ]);
  });

  it("guesses no task when no run is live", () => {
    const card = cardOf({ directories: [directory({ changes: [change({ nextOpenTask: { number: "2.4", text: "Write the tests" } })] })] });
    expect(card.run).toBeUndefined();
    expect(describeChangeCard(card, NOW).lines).toEqual(["1 of 3 tasks done"]);
  });

  it("says the task it was given, where that is the run's account", () => {
    const card = cardOf({ directories: [directory({ runs: [run({ task: { number: "3.1", text: "Ship", source: "command" } })] })] });
    expect(describeChangeCard(card, NOW).lines[0]).toBe("on task 3.1: Ship, the task it was given");
  });

  it("says what a waiting run waits on, and where", () => {
    const card = cardOf({ directories: [directory({ runs: [run({ waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } })] })] });
    expect(describeChangeCard(card, NOW).lines).toContain("waiting to continue to verify, in repo");
  });

  it("gives a cost only where one was reported", () => {
    const withCost = cardOf({ last: lastRun({ costUsd: 0.84 }) });
    const without = cardOf({ last: lastRun() });
    expect(describeChangeCard(withCost, NOW).lines).toContain("last run failed at verify 2 hours ago, $0.84");
    expect(describeChangeCard(without, NOW).lines).toContain("last run failed at verify 2 hours ago");
  });

  it("gives the reason of a stop that had one, and nothing for one that had none", () => {
    const withReason = cardOf({ last: lastRun({ outcome: "cancelled", endedAt: minutesBefore(5), reason: "maxRunSeconds is 1800s" }) });
    const without = cardOf({ last: lastRun({ outcome: "cancelled", endedAt: minutesBefore(5) }) });
    expect(describeChangeCard(withReason, NOW).lines).toContain("last run stopped at verify 5 minutes ago — maxRunSeconds is 1800s");
    expect(describeChangeCard(without, NOW).lines).toContain("last run stopped at verify 5 minutes ago");
  });

  it("counts ages from now", () => {
    const card = cardOf({ directories: [directory({ runs: [run()] })], last: lastRun({ outcome: "completed", endedAt: minutesBefore(60 * 26) }) });
    expect(describeChangeCard(card, NOW).lines).toContain("running apply — said 30s ago");
    expect(describeChangeCard(card, NOW).lines).toContain("last run completed at verify 1 day ago");
    const later = new Date(NOW.getTime() + 90_000);
    expect(describeChangeCard(card, later).lines).toContain("running apply — said 2 minutes ago");
  });

  it("says nothing of progress for a change with no tasks, and nothing of where for this checkout", () => {
    const card = cardOf({ directories: [directory({ changes: [change({ tasksDone: 0, tasksTotal: 0 })] })] });
    expect(describeChangeCard(card, NOW).lines).toEqual([]);
  });
});
