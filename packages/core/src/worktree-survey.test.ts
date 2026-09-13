import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { agentStatusDirectory } from "./agent-status.js";
import type { GitWorktree } from "./git.js";
import { describeDirectoryRuns, surveyWorktrees } from "./worktree-survey.js";

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
    expect(describeDirectoryRuns(survey.directories[1] as never)[0]).toMatch(/^change-b \(apply\): Bash: npm test — said \d+s ago$/);
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
