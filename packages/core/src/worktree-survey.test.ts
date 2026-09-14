import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { agentStatusDirectory } from "./agent-status.js";
import type { GitWorktree } from "./git.js";
import { describeDirectoryRuns, refreshSurveyRuns, surveyWorktrees, type SurveyedDirectory } from "./worktree-survey.js";

// every-varying-check-has-a-budget: no git process and no agent — the git
// wrapper is a fake that records its calls, and every directory is a
// temporary one. Measured 2026-09-13 at 334ms idle for all eleven tests
// together; the ceiling is for a loaded machine, not for this work.
vi.setConfig({ testTimeout: 15_000 });

const LF = String.fromCharCode(10);
const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-survey-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** A change in `directory` with the given ticks, and optional blockers. */
async function makeChange(
  directory: string,
  changeName: string,
  options: { ticks?: boolean[]; blockedBy?: string[] } = {},
): Promise<void> {
  const dir = path.join(directory, "openspec", "changes", changeName);
  await mkdir(dir, { recursive: true });
  const ticks = options.ticks ?? [false];
  await writeFile(
    path.join(dir, "tasks.md"),
    ticks.map((done, index) => `- [${done ? "x" : " "}] 1.${index + 1} Task ${index + 1}`).join(LF) + LF,
    "utf8",
  );
  const relations = (options.blockedBy ?? []).map((name) => `  - ${name}`);
  await writeFile(
    path.join(dir, ".openspec.yaml"),
    ["schema: spec-driven", "created: 2026-09-13", ...(relations.length > 0 ? ["blocked_by:", ...relations] : [])].join(LF) + LF,
    "utf8",
  );
}

async function writeLease(directory: string, options: { author?: string; ageMs?: number } = {}): Promise<void> {
  await mkdir(path.join(directory, ".openspec-ui"), { recursive: true });
  const heartbeatAt = new Date(Date.now() - (options.ageMs ?? 0)).toISOString();
  await writeFile(
    path.join(directory, ".openspec-ui", "workspace.lease.json"),
    JSON.stringify({
      version: 1,
      holderId: "someone",
      hostKind: "cli",
      hostname: "a-machine",
      pid: 4242,
      acquiredAt: heartbeatAt,
      heartbeatAt,
      ...(options.author !== undefined ? { author: options.author } : {}),
    }),
    "utf8",
  );
}

async function writeStatus(
  statusDirectory: string,
  record: { instanceId: string; workingDirectory: string; changeName?: string; stage?: string; activity: string; ageMs?: number },
): Promise<void> {
  await mkdir(statusDirectory, { recursive: true });
  const at = new Date(Date.now() - (record.ageMs ?? 0)).toISOString();
  await writeFile(
    path.join(statusDirectory, `${record.instanceId}.json`),
    JSON.stringify({
      version: 1,
      instanceId: record.instanceId,
      activity: record.activity,
      stage: record.stage ?? null,
      changeName: record.changeName ?? null,
      workingDirectory: record.workingDirectory,
      activityAt: at,
      heartbeatAt: at,
    }),
    "utf8",
  );
}

/** A git wrapper that records every call, so a test can say what the
 * survey asked git for — the cost ADR 0026 limits, which the code could
 * otherwise reacquire silently. */
function recordingGit(worktrees: GitWorktree[], identity?: string) {
  const calls: string[] = [];
  return {
    calls,
    git: {
      worktreeList: async () => {
        calls.push("worktreeList");
        return worktrees;
      },
      configuredIdentity: async () => {
        calls.push("configuredIdentity");
        return identity;
      },
    },
  };
}

/** A repository with its main directory and a worktree root, as the
 * survey locates the shared status directory. */
async function repository(): Promise<{ main: string; worktreeRoot: string; rootSources: { env: Record<string, string> } }> {
  const root = await temporaryRoot();
  const main = path.join(root, "repo");
  const worktreeRoot = path.join(root, "wt-root");
  await mkdir(main, { recursive: true });
  return { main, worktreeRoot, rootSources: { env: { OPENSPEC_UI_WORKTREE_ROOT: worktreeRoot } } };
}

describe("surveyWorktrees — directories and their changes", () => {
  // 6.1
  it("reports every working directory with its branch and its own changes and task counts", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    const second = path.join(worktreeRoot, "repo", "change-b");
    await makeChange(main, "change-a", { ticks: [true, false] });
    await makeChange(second, "change-b", { ticks: [true, true, false] });
    const { git } = recordingGit([{ path: main, branch: "main" }, { path: second, branch: "change-b" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    expect(survey.directories.map((d) => [d.label, d.branch, d.isMain, d.isThis])).toEqual([
      ["repo", "main", true, true],
      ["change-b", "change-b", false, false],
    ]);
    const [first, other] = survey.directories;
    expect(first?.readable && first.changes.map((c) => [c.changeName, c.tasksDone, c.tasksTotal])).toEqual([["change-a", 1, 2]]);
    expect(other?.readable && other.changes.map((c) => [c.changeName, c.tasksDone, c.tasksTotal])).toEqual([["change-b", 2, 3]]);
  });

  it("keeps a blocker only where it is active in the same directory", async () => {
    const { main, rootSources } = await repository();
    await makeChange(main, "first");
    await makeChange(main, "second", { blockedBy: ["first", "somewhere-else"] });
    const { git } = recordingGit([{ path: main, branch: "main" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    const [directory] = survey.directories;
    expect(directory?.readable && directory.changes.find((c) => c.changeName === "second")?.blockers).toEqual(["first"]);
  });

  // 6.3
  it("reports a directory that cannot be read as such, and keeps the rest", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    await makeChange(main, "change-a");
    const gone = path.join(worktreeRoot, "repo", "removed-by-hand");
    const { git } = recordingGit([{ path: main, branch: "main" }, { path: gone, branch: "removed-by-hand" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    expect(survey.directories[0]?.readable).toBe(true);
    expect(survey.directories[1]).toMatchObject({ readable: false, reason: "it does not exist", label: "removed-by-hand" });
  });

  // 6.4
  it("names a directory by its own name, and by the label it declares where it declares one", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    const second = path.join(worktreeRoot, "repo", "proposals");
    await mkdir(path.join(second, ".openspec-ui"), { recursive: true });
    await writeFile(path.join(second, ".openspec-ui", "worker.json"), JSON.stringify({ label: "Alex's proposals" }), "utf8");
    const { git } = recordingGit([{ path: main, branch: "main" }, { path: second, branch: "proposals" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    expect(survey.directories.map((d) => [d.label, d.labelDeclared])).toEqual([
      ["repo", false],
      ["Alex's proposals", true],
    ]);
  });

  // 6.5
  it("reports a change held by more than one directory, and refuses nothing", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    const second = path.join(worktreeRoot, "repo", "change-b");
    await makeChange(main, "shared-change");
    await makeChange(second, "shared-change");
    const { git } = recordingGit([{ path: main, branch: "main" }, { path: second, branch: "change-b" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    const [first, other] = survey.directories;
    expect(first?.readable && first.changes[0]?.alsoIn).toEqual([second]);
    expect(other?.readable && other.changes[0]?.alsoIn).toEqual([main]);
  });

  // a-change-is-running-when-its-run-says-so 4.4
  it("says which change a worktree belongs to only while that change is active in the main directory", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    const own = path.join(worktreeRoot, "repo", "still-going");
    const archived = path.join(worktreeRoot, "repo", "long-archived");
    const other = path.join(worktreeRoot, "repo", "proposals");
    await makeChange(main, "still-going");
    await makeChange(own, "still-going");
    await makeChange(archived, "long-archived");
    await makeChange(other, "still-going");
    const { git } = recordingGit([
      { path: main, branch: "still-going" },
      { path: own, branch: "still-going" },
      { path: archived, branch: "long-archived" },
      { path: other, branch: "Some/Feature" },
    ]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    // The main directory belongs to no change whatever its branch; a worktree
    // whose change is no longer active in main, or whose branch names none,
    // belongs to none either.
    expect(survey.directories.map((d) => d.belongsTo)).toEqual([undefined, "still-going", undefined, undefined]);
  });

  // 6.6, 6.12
  it("asks git for the worktree list and this checkout's identity, and nothing per directory", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    const directories = ["one", "two", "three"].map((name) => path.join(worktreeRoot, "repo", name));
    for (const directory of directories) await makeChange(directory, `change-${path.basename(directory)}`);
    const { git, calls } = recordingGit([
      { path: main, branch: "main" },
      ...directories.map((directory) => ({ path: directory, branch: path.basename(directory) })),
    ]);
    await writeStatus(agentStatusDirectory(worktreeRoot, main), {
      instanceId: "run-1",
      workingDirectory: directories[0] as string,
      activity: "Bash: npm test",
    });

    await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    expect(calls).toEqual(["worktreeList", "configuredIdentity"]);
  });
});

describe("surveyWorktrees — what a card needs from a task list (a-card-says-what-its-change-is-doing 1.2)", () => {
  it("counts what only a person and what a delegated agent can close, and finds the task a run is probably on", async () => {
    const { main, rootSources } = await repository();
    const dir = path.join(main, "openspec", "changes", "carded");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, ".openspec.yaml"), `schema: spec-driven${LF}`, "utf8");
    await writeFile(path.join(dir, "tasks.md"), [
      "- [x] 1.1 Done already",
      "- [ ] 1.2 **Human-only**: look at it",
      "- [ ] 1.3 **Delegated to claude-cli**: check it",
      "- [ ] 1.4 Write the reader",
      "- [ ] 1.5 Pair it with the list",
    ].join(LF) + LF, "utf8");
    const { git } = recordingGit([{ path: main, branch: "main" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    const [directory] = survey.directories;
    const change = directory?.readable ? directory.changes.find((candidate) => candidate.changeName === "carded") : undefined;
    expect(change).toMatchObject({
      tasksDone: 1,
      tasksTotal: 5,
      tasksForPerson: 1,
      tasksDelegated: 1,
      // The first open item that is neither Human-only nor delegated.
      nextOpenTask: { number: "1.4", text: "Write the reader" },
    });
    expect(Number.isFinite(Date.parse(change?.tasksModifiedAt ?? ""))).toBe(true);
  });

  // a-card-opens-to-its-tasks 1.2: every item travels with the survey, with
  // its section and who may close it.
  it("carries every task row, with its number, section and who may close it", async () => {
    const { main, rootSources } = await repository();
    const dir = path.join(main, "openspec", "changes", "rowed");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, ".openspec.yaml"), `schema: spec-driven${LF}`, "utf8");
    await writeFile(path.join(dir, "tasks.md"), [
      "- [ ] An item before any heading",
      "## 1. Reading",
      "- [x] 1.1 Done already",
      "- [ ] 1.2 **Human-only**: look at it",
      "## Checking",
      "- [ ] 2.1 **Delegated to claude-cli**: check it",
    ].join(LF) + LF, "utf8");
    const { git } = recordingGit([{ path: main, branch: "main" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    const [directory] = survey.directories;
    const change = directory?.readable ? directory.changes.find((candidate) => candidate.changeName === "rowed") : undefined;
    expect(change?.tasks).toEqual([
      { text: "An item before any heading", done: false, closedBy: "agent" },
      { number: "1.1", text: "Done already", section: "Reading", done: true, closedBy: "agent" },
      { number: "1.2", text: "**Human-only**: look at it", section: "Reading", done: false, closedBy: "person" },
      { number: "2.1", text: "**Delegated to claude-cli**: check it", section: "Checking", done: false, closedBy: "named-agent", agent: "claude-cli" },
    ]);
  });

  it("carries none of the four for a change with no task list", async () => {
    const { main, rootSources } = await repository();
    const dir = path.join(main, "openspec", "changes", "listless");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, ".openspec.yaml"), `schema: spec-driven${LF}`, "utf8");
    const { git } = recordingGit([{ path: main, branch: "main" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    const [directory] = survey.directories;
    const change = directory?.readable ? directory.changes.find((candidate) => candidate.changeName === "listless") : undefined;
    expect(change).toBeDefined();
    for (const field of ["tasksForPerson", "tasksDelegated", "nextOpenTask", "tasksModifiedAt"]) {
      expect(change).not.toHaveProperty(field);
    }
  });
});

describe("surveyWorktrees — who holds a directory", () => {
  // 6.2
  it("reports a directory with no lease as held by nobody", async () => {
    const { main, rootSources } = await repository();
    await makeChange(main, "change-a");
    const { git } = recordingGit([{ path: main, branch: "main" }], "Me <me@example.invalid>");

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    const [directory] = survey.directories;
    expect(directory?.readable && directory.holder).toBeUndefined();
    expect(directory?.readable && directory.authorDiffers).toBe(false);
  });

  // 3.1
  it("marks a directory whose lease records another git author, and not one that records this checkout's", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    const mine = path.join(worktreeRoot, "repo", "mine");
    const theirs = path.join(worktreeRoot, "repo", "theirs");
    await makeChange(mine, "change-mine");
    await makeChange(theirs, "change-theirs");
    await writeLease(mine, { author: "Me <me@example.invalid>" });
    await writeLease(theirs, { author: "Someone Else <else@example.invalid>" });
    const { git } = recordingGit(
      [{ path: main, branch: "main" }, { path: mine, branch: "mine" }, { path: theirs, branch: "theirs" }],
      "Me <me@example.invalid>",
    );

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    expect(survey.directories.map((d) => [d.label, d.readable && d.authorDiffers])).toEqual([
      ["repo", false],
      ["mine", false],
      ["theirs", true],
    ]);
  });
});

describe("surveyWorktrees — what a directory's runs say", () => {
  // 6.10
  it("attaches a status record to the directory it names, and reports one for a removed directory as belonging to none", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    const second = path.join(worktreeRoot, "repo", "change-b");
    await makeChange(second, "change-b");
    const statusDirectory = agentStatusDirectory(worktreeRoot, main);
    await writeStatus(statusDirectory, {
      instanceId: "run-here",
      workingDirectory: second,
      changeName: "change-b",
      stage: "apply",
      activity: "Bash: npm test",
      ageMs: 3_000,
    });
    await writeStatus(statusDirectory, {
      instanceId: "run-orphan",
      workingDirectory: path.join(worktreeRoot, "repo", "long-gone"),
      activity: "Edit a.ts",
    });
    const { git } = recordingGit([{ path: main, branch: "main" }, { path: second, branch: "change-b" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    expect(survey.directories[0]?.runs).toEqual([]);
    expect(survey.directories[1]?.runs).toMatchObject([
      { instanceId: "run-here", changeName: "change-b", stage: "apply", activity: "Bash: npm test", gone: false },
    ]);
    expect(survey.runsElsewhere.map((run) => run.instanceId)).toEqual(["run-orphan"]);
    expect(describeDirectoryRuns(survey.directories[1] as never)[0]).toMatch(/^change-b \(apply\): Bash: npm test — said \d+s ago; not verified$/);
  });

  it("shows a run whose record has lapsed as gone", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    await writeStatus(agentStatusDirectory(worktreeRoot, main), {
      instanceId: "run-lapsed",
      workingDirectory: main,
      activity: "Write hello.txt",
      ageMs: 60_000,
    });
    const { git } = recordingGit([{ path: main, branch: "main" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    expect(survey.directories[0]?.runs[0]?.gone).toBe(true);
    expect(describeDirectoryRuns(survey.directories[0] as never)[0]).toContain("gone");
  });

  // a-stale-status-is-swept 2.3
  it("removes a lapsed record only when asked to sweep, keeps a live one, and asks git for nothing more", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    const statusDirectory = agentStatusDirectory(worktreeRoot, main);
    await writeStatus(statusDirectory, { instanceId: "run-lapsed", workingDirectory: main, activity: "Write hello.txt", ageMs: 60_000 });
    await writeStatus(statusDirectory, { instanceId: "run-live", workingDirectory: main, activity: "Bash: npm test" });
    const runIds = (survey: Awaited<ReturnType<typeof surveyWorktrees>>): string[] =>
      (survey.directories[0]?.runs ?? []).map((run) => run.instanceId).sort();

    const reading = await surveyWorktrees({ workspaceRoot: main, git: recordingGit([{ path: main, branch: "main" }]).git, rootSources });
    expect(runIds(reading)).toEqual(["run-lapsed", "run-live"]);

    const { git, calls } = recordingGit([{ path: main, branch: "main" }]);
    const swept = await surveyWorktrees({ workspaceRoot: main, git, rootSources, sweepStatuses: true });
    expect(runIds(swept)).toEqual(["run-live"]);
    expect(calls).toEqual(["worktreeList", "configuredIdentity"]);

    // Gone from disk, not only from that reading.
    const afterwards = await surveyWorktrees({ workspaceRoot: main, git: recordingGit([{ path: main, branch: "main" }]).git, rootSources });
    expect(runIds(afterwards)).toEqual(["run-live"]);
  });

  // 6.11
  it("describes a directory no run reports from as such, and nowhere calls anything idle", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    const second = path.join(worktreeRoot, "repo", "quiet");
    await makeChange(main, "change-a");
    await makeChange(second, "change-quiet");
    const { git } = recordingGit([{ path: main, branch: "main" }, { path: second, branch: "quiet" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    expect(survey.directories.map((d) => describeDirectoryRuns(d))).toEqual([["no run reports here"], ["no run reports here"]]);
    // Against the whole shape, because that word is the one somebody will
    // helpfully add later.
    expect(JSON.stringify(survey)).not.toMatch(/idle|stuck|hung|healthy/i);
  });
});

describe("refreshSurveyRuns — the runs read again, without git", () => {
  // the-pipeline-opens-in-vs-code 2.2, 2.5. A status record is rewritten
  // every few seconds while a run lives; re-reading the records must not
  // mean listing the worktrees again each time.
  const gitThatMustNotRun = {
    worktreeList: async (): Promise<GitWorktree[]> => { throw new Error("git was run"); },
    configuredIdentity: async (): Promise<string | undefined> => { throw new Error("git was run"); },
  };

  it("moves a run to the directory its new record names, drops a record gone from disk, and keeps the rest of the survey", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    const second = path.join(worktreeRoot, "repo", "change-b");
    await makeChange(main, "change-a");
    await makeChange(second, "change-b", { ticks: [true, false] });
    const statusDirectory = agentStatusDirectory(worktreeRoot, main);
    await writeStatus(statusDirectory, { instanceId: "run-moving", workingDirectory: main, activity: "Read a.ts" });
    await writeStatus(statusDirectory, { instanceId: "run-ending", workingDirectory: main, activity: "Bash: npm test" });
    const { git } = recordingGit([{ path: main, branch: "main" }, { path: second, branch: "change-b" }], "Me <me@example.invalid>");
    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });
    expect(survey.directories[0]?.runs.map((run) => run.instanceId).sort()).toEqual(["run-ending", "run-moving"]);

    await writeStatus(statusDirectory, { instanceId: "run-moving", workingDirectory: second, activity: "Edit b.ts" });
    await rm(path.join(statusDirectory, "run-ending.json"));
    const refreshed = await refreshSurveyRuns(survey, { git: gitThatMustNotRun, rootSources });

    expect(refreshed.directories[0]?.runs).toEqual([]);
    expect(refreshed.directories[1]?.runs).toMatchObject([{ instanceId: "run-moving", activity: "Edit b.ts" }]);
    expect(refreshed.runsElsewhere).toEqual([]);
    // Directories, changes and identity stay as the survey read them.
    expect(refreshed.directories.map((d) => [d.label, d.branch])).toEqual([["repo", "main"], ["change-b", "change-b"]]);
    const other = refreshed.directories[1];
    expect(other?.readable && other.changes.map((c) => [c.changeName, c.tasksDone, c.tasksTotal])).toEqual([["change-b", 1, 2]]);
    expect(refreshed.thisAuthor).toBe("Me <me@example.invalid>");
  });

  it("reports a record whose directory is not a working directory of the survey as belonging to none", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    const { git } = recordingGit([{ path: main, branch: "main" }]);
    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    await writeStatus(agentStatusDirectory(worktreeRoot, main), {
      instanceId: "run-elsewhere",
      workingDirectory: path.join(worktreeRoot, "repo", "not-listed"),
      activity: "Edit c.ts",
    });
    const refreshed = await refreshSurveyRuns(survey, { git: gitThatMustNotRun, rootSources });

    expect(refreshed.directories[0]?.runs).toEqual([]);
    expect(refreshed.runsElsewhere.map((run) => run.instanceId)).toEqual(["run-elsewhere"]);
  });
});

describe("describeDirectoryRuns — ages that keep counting", () => {
  // the-pipeline-opens-in-vs-code 2.4. A picture read once and kept on
  // screen for a minute must not keep saying "12s ago".
  const directory: SurveyedDirectory = {
    path: "/repo",
    label: "repo",
    labelDeclared: false,
    isMain: true,
    isThis: true,
    readable: true,
    changes: [],
    authorDiffers: false,
    runs: [{
      instanceId: "run-1",
      changeName: "change-a",
      stage: "apply",
      activity: "Bash: npm test",
      activitySinceMs: 12_000,
      heartbeatAgeMs: 2_000,
      activityAt: "2026-09-13T12:00:00.000Z",
      heartbeatAt: "2026-09-13T12:00:10.000Z",
      gone: false,
      workingDirectory: "/repo",
      runId: null,
      waiting: null,
      signature: "unverified",
    }],
  };

  it("states the interval measured at read time when given no clock", () => {
    expect(describeDirectoryRuns(directory)).toEqual(["change-a (apply): Bash: npm test — said 12s ago; not verified"]);
  });

  it("counts from the record's own timestamps when given a clock", () => {
    expect(describeDirectoryRuns(directory, new Date("2026-09-13T12:01:00.000Z")))
      .toEqual(["change-a (apply): Bash: npm test — said 60s ago; not verified"]);
  });

  // a-run-is-signed-by-its-person 5.5
  it("says a verified run is signed by its enrolled person, and claims nothing more", () => {
    const signed: SurveyedDirectory = {
      ...directory,
      runs: [{ ...directory.runs[0]!, signature: "verified", person: { keyId: "k".repeat(32), label: "Ada" } }],
    };
    expect(describeDirectoryRuns(signed)).toEqual(["change-a (apply): Bash: npm test — said 12s ago; signed by Ada, verified"]);
  });

  it("says nothing from a record that does not check out but that it does not", () => {
    const tampered: SurveyedDirectory = {
      ...directory,
      runs: [{ ...directory.runs[0]!, signature: "does-not-check-out" }],
    };
    expect(describeDirectoryRuns(tampered)).toEqual(["run-1: its signature does not check out"]);
  });

  it("counts a gone run's silence from its last heartbeat", () => {
    const gone: SurveyedDirectory = { ...directory, runs: [{ ...directory.runs[0]!, gone: true }] };
    expect(describeDirectoryRuns(gone, new Date("2026-09-13T12:02:10.000Z"))[0])
      .toContain("last heard from 120s ago");
  });

  it("says what a waiting run waits on in place of its stage", () => {
    const waiting: SurveyedDirectory = {
      ...directory,
      runs: [{ ...directory.runs[0]!, waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } }],
    };
    expect(describeDirectoryRuns(waiting)).toEqual(["change-a: waiting to continue to verify — said 12s ago; not verified"]);
  });
});

describe("surveyWorktrees — the task a run is on (a-run-says-which-task-it-is-on)", () => {
  // 5.5. The record carries the number; the survey pairs it with the
  // change's own list, which it has already read.
  async function writeRecordOnTask(statusDirectory: string, workingDirectory: string, changeName: string, number: string) {
    await mkdir(statusDirectory, { recursive: true });
    const at = new Date().toISOString();
    await writeFile(path.join(statusDirectory, "run-on-task.json"), JSON.stringify({
      version: 1,
      instanceId: "run-on-task",
      activity: "Edit a.ts",
      stage: "apply",
      changeName,
      workingDirectory,
      activityAt: at,
      heartbeatAt: at,
      runId: "run-1",
      task: { number, source: "agent", since: at },
      waiting: null,
    }), "utf8");
  }

  it("surveys a run with the task its record names, its text and its source", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    await makeChange(main, "change-a", { ticks: [true, false] });
    await writeRecordOnTask(agentStatusDirectory(worktreeRoot, main), main, "change-a", "1.2");
    const { git } = recordingGit([{ path: main, branch: "main" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    const run = survey.directories[0]?.runs[0];
    expect(run?.task).toEqual({ number: "1.2", text: "Task 2", source: "agent" });
    expect(run?.runId).toBe("run-1");
    expect(describeDirectoryRuns(survey.directories[0] as never)[0]).toContain("on task 1.2: Task 2, by its own account");
  });

  it("surveys a run whose record names a number the list does not have with no task", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    await makeChange(main, "change-a", { ticks: [false, false] });
    await writeRecordOnTask(agentStatusDirectory(worktreeRoot, main), main, "change-a", "9.9");
    const { git } = recordingGit([{ path: main, branch: "main" }]);

    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    expect(survey.directories[0]?.runs[0]?.task).toBeUndefined();
    expect(describeDirectoryRuns(survey.directories[0] as never)[0]).not.toContain("on task");
  });

  it("pairs the task again when the runs are read again without git", async () => {
    const { main, worktreeRoot, rootSources } = await repository();
    await makeChange(main, "change-a", { ticks: [false, false] });
    const { git } = recordingGit([{ path: main, branch: "main" }]);
    const survey = await surveyWorktrees({ workspaceRoot: main, git, rootSources });

    await writeRecordOnTask(agentStatusDirectory(worktreeRoot, main), main, "change-a", "1.1");
    const refreshed = await refreshSurveyRuns(survey, {
      rootSources,
      git: {
        worktreeList: async () => { throw new Error("git was run"); },
        configuredIdentity: async () => { throw new Error("git was run"); },
      },
    });

    expect(refreshed.directories[0]?.runs[0]?.task).toEqual({ number: "1.1", text: "Task 1", source: "agent" });
  });
});
