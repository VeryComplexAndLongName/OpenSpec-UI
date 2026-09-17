import { describe, expect, it } from "vitest";
import { AGENT_STATUS_RENEW_INTERVAL_MS } from "./agent-status.js";
import {
  describeChangeCard,
  describeChangeCards,
  describeTaskRows,
  runsShownOnCards,
  STOP_REQUEST_READ_WITHIN_MS,
  type ChangeCard,
  type ChangeCardInputs,
} from "./change-card.js";
import type { ChangeReadiness } from "./change-readiness-facts.js";
import type { ChangeStanding } from "./change-standing-facts.js";
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
  liveRunIds?: string[];
  myLabel?: string;
  stopsAsked?: Map<string, string>;
  standings?: ChangeStanding[];
} = {}): ChangeCard {
  const inputs: ChangeCardInputs = {
    report: { changes: [readiness(options.run)] },
    survey: { directories: options.directories ?? [directory()], runsElsewhere: [] },
    ...(options.last !== undefined ? { lastRuns: { byChange: { demo: options.last } } } : {}),
    ...(options.liveRunIds !== undefined ? { liveRunIds: options.liveRunIds } : {}),
    ...(options.myLabel !== undefined ? { myLabel: options.myLabel } : {}),
    ...(options.stopsAsked !== undefined ? { stopsAsked: options.stopsAsked } : {}),
    ...(options.standings !== undefined
      ? { standings: { readAt: NOW.toISOString(), standings: options.standings, sources: { fetch: { attempted: false }, pullRequests: { read: true } } } }
      : {}),
    now: NOW,
  };
  const [card] = describeChangeCards(inputs);
  return card!;
}

// a-run-elsewhere-can-be-asked-to-stop 3.2, 3.4 and 3.5.
describe("describeChangeCards — a run held elsewhere", () => {
  const ada = { keyId: "key-ada", label: "Ada" };
  const bob = { keyId: "key-bob", label: "Bob" };

  it("marks a run stoppable by me only when its record is verified and signed by my own label", () => {
    const verifiedAda = [directory({ runs: [run({ signature: "verified", person: ada })] })];

    expect(cardOf({ directories: verifiedAda, myLabel: "Ada" }).run?.stoppableByMe).toBe(true);
    expect(cardOf({ directories: verifiedAda, myLabel: "Bob" }).run?.stoppableByMe).toBe(false);
    expect(cardOf({ directories: verifiedAda }).run?.stoppableByMe).toBe(false);
    expect(cardOf({ directories: [directory({ runs: [run({ signature: "unverified" })] })], myLabel: "Ada" }).run?.stoppableByMe).toBe(false);
    // A run this host holds is stopped as its own, not through the channel.
    expect(cardOf({ directories: verifiedAda, myLabel: "Ada", liveRunIds: ["r1"] }).run?.stoppableByMe).toBe(false);
  });

  it("says whose a run held elsewhere is, and says nothing of it for my own", () => {
    const lines = (card: ChangeCard) => describeChangeCard(card, NOW).lines;

    expect(lines(cardOf({ directories: [directory({ runs: [run({ signature: "verified", person: bob })] })], myLabel: "Ada" }))).toContain("Bob's run, verified");
    expect(lines(cardOf({ directories: [directory({ runs: [run({ signature: "unverified" })] })], myLabel: "Ada" }))).toContain("not verified");
    const mine = lines(cardOf({ directories: [directory({ runs: [run({ signature: "verified", person: ada })] })], myLabel: "Ada" }));
    expect(mine).not.toContain("Ada's run, verified");
    expect(mine).not.toContain("not verified");
  });

  it("says a request is waiting for the run to read it, then that the run has not, and nothing once the record shows the stop", () => {
    const asked = (secondsAgo: number) => new Map([["i1", new Date(NOW.getTime() - secondsAgo * 1000).toISOString()]]);
    const mine = [directory({ runs: [run({ signature: "verified", person: ada })] })];
    const lines = (card: ChangeCard) => describeChangeCard(card, NOW).lines;

    expect(lines(cardOf({ directories: mine, myLabel: "Ada", stopsAsked: asked(5) }))).toContain("stop requested 5s ago; waiting for the run to read it");
    expect(lines(cardOf({ directories: mine, myLabel: "Ada", stopsAsked: asked(30) }))).toContain("stop requested 30s ago; the run has not read the request");
    const heard = [directory({ runs: [run({ signature: "verified", person: ada, stopRequested: { reason: "live check", by: "Ada", at: NOW.toISOString() } })] })];
    expect(lines(cardOf({ directories: heard, myLabel: "Ada", stopsAsked: asked(30) })).some((line) => line.startsWith("stop requested"))).toBe(false);
  });

  it("waits two of the status writer's renewals before saying a request was not read", () => {
    expect(STOP_REQUEST_READ_WITHIN_MS).toBe(2 * AGENT_STATUS_RENEW_INTERVAL_MS);
  });
});

describe("describeChangeCards — the state, first match wins", () => {
  it("is waiting for a live run whose record waits, even where a lease says running", () => {
    const card = cardOf({
      run: { state: "running", worktreePath: "/repo" },
      directories: [directory({ runs: [run({ waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } })] })],
      last: lastRun(),
    });
    expect(card.state).toBe("waiting");
    // Held by no host showing this card: waiting, and where.
    expect(card.run?.ownedHere).toBe(false);
    expect(describeChangeCard(card, NOW).stateWords).toBe("Waiting in repo");
  });

  // a-change-is-run-from-its-card 5.1
  it("says Waiting for you only for a waiting run this host holds", () => {
    const waiting = directory({ runs: [run({ runId: "r1", waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } })] });

    const held = cardOf({ directories: [waiting], liveRunIds: ["r1"] });
    expect(held.run).toMatchObject({ runId: "r1", ownedHere: true });
    expect(describeChangeCard(held, NOW)).toMatchObject({ stateWords: "Waiting for you" });
    expect(describeChangeCard(held, NOW).lines).toContain("waiting to continue to verify, in repo");

    const elsewhere = cardOf({ directories: [waiting], liveRunIds: ["another-run"] });
    expect(elsewhere.run?.ownedHere).toBe(false);
    expect(describeChangeCard(elsewhere, NOW).stateWords).toBe("Waiting in repo");
    expect(describeChangeCard(elsewhere, NOW).lines).toContain("waiting to continue to verify, in repo — answered where it was started");
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
      // Not held here, so the card says whose the run is
      // (a-run-elsewhere-can-be-asked-to-stop 3.4).
      "not verified",
      "2 of 3 tasks done",
      "in demo-worktree, on branch demo",
    ]);
  });

  // the-pipeline-answers-while-a-run-works 5.6: the standings reading is
  // slower than the survey, and was a reading behind while apply ran.
  it("takes the word's runs from the survey, not from a standings reading taken before the run", () => {
    const before: ChangeStanding = {
      changeName: "demo",
      here: { label: "repo", path: "C:/repo", counts: { done: 1, total: 3 }, runs: [] },
      elsewhere: [{ label: "spare", path: "/wt/spare", runs: [] }],
    };
    const card = cardOf({
      run: { state: "running", worktreePath: "/repo" },
      directories: [directory({ runs: [run()] }), directory({ path: "/wt/spare", label: "spare", isMain: false, isThis: false, runs: [run({ instanceId: "i2", workingDirectory: "/wt/spare" })] })],
      standings: [before],
    });

    expect(describeChangeCard(card, NOW)).toMatchObject({ stateWords: "Running", lines: expect.arrayContaining(["running apply — said 30s ago"]) });
    expect(card.stateFacts.standing.here?.runs).toEqual([{ instanceId: "i1", stage: "apply", waiting: false }]);
    expect(card.stateFacts.standing.elsewhere[0]?.runs).toEqual([{ instanceId: "i2", stage: "apply", waiting: false }]);
    // What else the standing read still stands.
    expect(card.stateFacts.standing.here?.counts).toEqual({ done: 1, total: 3 });
  });

  it("keeps a copy's runs where the survey does not list its directory", () => {
    const standing: ChangeStanding = {
      changeName: "demo",
      here: { label: "repo", path: "/repo", runs: [] },
      elsewhere: [{ label: "gone", path: "/wt/gone", runs: [{ instanceId: "i9", stage: "verify", waiting: true }] }],
    };
    const card = cardOf({ standings: [standing] });
    expect(card.stateFacts.standing.elsewhere[0]?.runs).toEqual([{ instanceId: "i9", stage: "verify", waiting: true }]);
    expect(describeChangeCard(card, NOW).stateWords).toBe("Waiting in gone");
  });

  it("ignores a run of another change in the same directory", () => {
    const card = cardOf({ directories: [directory({ runs: [run({ changeName: "other" })] })] });
    expect(card.run).toBeUndefined();
    expect(card.state).toBe("ready");
  });
});

// a-card-opens-to-its-tasks 1.3: each row's word, from a closed set, and
// one row in hand at most.
describe("describeTaskRows", () => {
  const rows = [
    { number: "1.1", text: "Read", done: true, closedBy: "agent" as const },
    { number: "1.2", text: "Write", done: false, closedBy: "agent" as const },
    { number: "1.3", text: "Look", done: false, closedBy: "person" as const },
    { number: "1.4", text: "Check", done: false, closedBy: "named-agent" as const, agent: "claude-cli" },
    { number: "1.5", text: "Ship", done: false, closedBy: "agent" as const },
  ];

  it("says each word: done, in hand, a person's, delegated, and open", () => {
    expect(describeTaskRows(rows, { number: "1.2", text: "Write", source: "agent" }).map((row) => row.word)).toEqual([
      "done",
      "in hand",
      "only a person can close it",
      "delegated to claude-cli",
      "open",
    ]);
  });

  it("says probably next for a guess, and neither for a card with no task in hand", () => {
    expect(describeTaskRows(rows, { number: "1.2", text: "Write", source: "guess" })[1]?.word).toBe("probably next");
    expect(describeTaskRows(rows, undefined).map((row) => row.word)).not.toContain("in hand");
  });

  it("puts one row in hand even where a number repeats, and none on a done row", () => {
    const repeated = [...rows, { number: "1.2", text: "Write again", done: false, closedBy: "agent" as const }];
    const words = describeTaskRows(repeated, { number: "1.2", text: "Write", source: "command" }).map((row) => row.word);
    expect(words.filter((word) => word === "in hand")).toHaveLength(1);
    expect(describeTaskRows(rows, { number: "1.1", text: "Read", source: "agent" }).map((row) => row.word)).not.toContain("in hand");
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
      "not verified",
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
    expect(describeChangeCard(card, NOW).lines).toContain("waiting to continue to verify, in repo — answered where it was started");
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
