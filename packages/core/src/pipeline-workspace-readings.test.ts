import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitWrapper } from "./git.js";

// the-pipeline-reads-each-workspace-once: how often the Pipeline's readings
// read a workspace, and which of its lists. Each reading of this
// repository's workspace took 0.8 s, most of it the 256 archived changes;
// asked once per task list, a survey of three working directories took
// 39 s and the editor's Pipeline panel timed out. The results are the other
// test files' concern; this one counts.
//
// every-varying-check-has-a-budget: temporary directories and a fake git
// only. Measured 2026-09-17 well under a second idle; the ceiling is for a
// loaded machine, not for this work.
vi.setConfig({ testTimeout: 15_000 });

const readings = vi.hoisted(() => [] as Array<{ root: string; changes: string | undefined }>);

vi.mock("./workbench.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./workbench.js")>();
  return {
    ...original,
    discoverOpenSpecWorkspace: (root: string, options: Parameters<typeof original.discoverOpenSpecWorkspace>[1] = {}) => {
      readings.push({ root: path.resolve(root), changes: options.changes });
      return original.discoverOpenSpecWorkspace(root, options);
    },
  };
});

const { surveyWorktrees } = await import("./worktree-survey.js");
const { readChangeReadiness } = await import("./change-readiness.js");
const { readTaskChecklist } = await import("./task-checklist.js");

const LF = String.fromCharCode(10);
const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-pipeline-readings-"));
  temporaryRoots.push(root);
  return root;
}

beforeEach(() => {
  readings.splice(0);
});

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** A directory with `names` active, each with a task list, and one archived change. */
async function directoryWith(directory: string, names: string[]): Promise<void> {
  for (const name of names) {
    const dir = path.join(directory, "openspec", "changes", name);
    await mkdir(path.join(dir, "specs", "demo"), { recursive: true });
    await writeFile(path.join(dir, "tasks.md"), `- [x] 1.1 One${LF}- [ ] 1.2 Two${LF}`, "utf8");
    await writeFile(path.join(dir, "specs", "demo", "spec.md"), `## ADDED Requirements${LF}`, "utf8");
  }
  const archived = path.join(directory, "openspec", "changes", "archive", "2026-09-01-old");
  await mkdir(archived, { recursive: true });
  await writeFile(path.join(archived, "tasks.md"), `- [x] 1.1 Done${LF}`, "utf8");
}

function fakeGit(worktrees: Array<{ path: string; branch?: string }>): GitWrapper {
  return {
    worktreeList: async () => worktrees,
    configuredIdentity: async () => undefined,
    changedFilesBetween: async () => [],
  } as unknown as GitWrapper;
}

describe("the Pipeline's readings of a workspace", () => {
  it("surveys each working directory with one reading of its active changes, however many task lists it holds", async () => {
    const root = await temporaryRoot();
    const main = path.join(root, "repo");
    const other = path.join(root, "wt", "repo", "spare");
    await directoryWith(main, ["alpha", "beta", "gamma"]);
    await directoryWith(other, ["alpha", "delta"]);

    const survey = await surveyWorktrees({
      workspaceRoot: main,
      git: fakeGit([{ path: main, branch: "main" }, { path: other, branch: "spare" }]),
      rootSources: { env: { OPENSPEC_UI_WORKTREE_ROOT: path.join(root, "wt") } },
    });

    expect(readings).toEqual([
      { root: path.resolve(main), changes: "active" },
      { root: path.resolve(other), changes: "active" },
    ]);
    // The lists are still read, from that one reading.
    const [first] = survey.directories;
    expect(first?.readable && first.changes.map((change) => [change.changeName, change.tasksDone, change.tasksTotal])).toEqual([
      ["alpha", 1, 2],
      ["beta", 1, 2],
      ["gamma", 1, 2],
    ]);
  });

  it("builds a readiness report from one reading of the active changes, capabilities included", async () => {
    const root = await temporaryRoot();
    const main = path.join(root, "repo");
    await directoryWith(main, ["alpha", "beta"]);

    const report = await readChangeReadiness({
      workspaceRoot: main,
      git: fakeGit([{ path: main, branch: "main" }]),
      statuses: [],
    });

    // One for the report, one for the list of worktrees it pairs changes with.
    expect(readings).toEqual([
      { root: path.resolve(main), changes: "active" },
      { root: path.resolve(main), changes: "active" },
    ]);
    expect(report.changes.map((change) => [change.changeName, change.capabilities])).toEqual([
      ["alpha", ["demo"]],
      ["beta", ["demo"]],
    ]);
  });

  it("looks for a task list only in the list the change is named in", async () => {
    const root = await temporaryRoot();
    await directoryWith(root, ["alpha"]);

    expect((await readTaskChecklist(root, "alpha", false)).map((item) => item.done)).toEqual([true, false]);
    expect((await readTaskChecklist(root, "2026-09-01-old", true)).map((item) => item.done)).toEqual([true]);
    expect(readings.map((reading) => reading.changes)).toEqual(["active", "archived"]);
  });
});
