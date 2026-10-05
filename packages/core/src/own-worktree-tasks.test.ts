import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentStatusReport } from "./agent-status.js";
import type { GitWorktree } from "./git.js";
import { describeTaskDebts, parseTaskChecklist } from "./task-checklist.js";
import { readChangeTaskRows, resolveOwnWorktree, runOwnDelegatedItem, setTaskDone, taskListCommitMessage } from "./own-worktree-tasks.js";

// a-card-works-its-own-tasks 2.1 and 2.3. The worktree list is a stand-in,
// so no git process is started; the files are real.
// every-varying-check-has-a-budget: temporary files only, no process.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const TASKS = [
  "## 1. Work",
  "",
  "- [ ] 1.1 Write the module.",
  "- [ ] 1.2 **Human-only**: see it in the Pipeline, with",
  "  the card open.",
  "",
  "  An earlier remark after a blank line.",
  "- [x] 1.3 Already done.",
  "",
].join("\n");

async function fixture(options: { tasks?: string | null; branch?: string } = {}): Promise<{ root: string; worktree: string; worktrees: GitWorktree[] }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "own-worktree-"));
  roots.push(root);
  const main = path.join(root, "main");
  const worktree = path.join(root, "wt", "demo");
  await mkdir(main, { recursive: true });
  if (options.tasks !== null) {
    const dir = path.join(worktree, "openspec", "changes", "demo");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "tasks.md"), options.tasks ?? TASKS, "utf8");
  } else {
    await mkdir(worktree, { recursive: true });
  }
  return {
    root,
    worktree,
    worktrees: [{ path: main, branch: "main" }, { path: worktree, branch: options.branch ?? "demo" }],
  };
}

const quiet = { readLease: async () => undefined, readStatuses: async () => [] as AgentStatusReport[] };

describe("resolveOwnWorktree", () => {
  it("finds the worktree on the change's branch that holds its tasks.md", async () => {
    const { worktree, worktrees } = await fixture();
    const own = await resolveOwnWorktree({ repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees } });
    expect(own).toMatchObject({ ok: true, path: worktree, branch: "demo", mainBranch: "main" });
  });

  it("refuses a change with no worktree, one on another branch, and the main checkout on that branch", async () => {
    const { worktrees } = await fixture({ branch: "other" });
    const none = await resolveOwnWorktree({ repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees } });
    expect(none).toMatchObject({ ok: false, kind: "no-worktree" });

    const mainOnIt = await resolveOwnWorktree({
      repositoryRoot: "/repo",
      changeName: "demo",
      git: { worktreeList: async () => [{ path: "/main", branch: "demo" }] },
    });
    expect(mainOnIt).toMatchObject({ ok: false, kind: "no-worktree" });
  });

  it("refuses a worktree without the change's tasks.md, and a name that is not a change name", async () => {
    const { worktrees } = await fixture({ tasks: null });
    expect(await resolveOwnWorktree({ repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees } }))
      .toMatchObject({ ok: false, kind: "no-task-list" });
    expect(await resolveOwnWorktree({ repositoryRoot: "/repo", changeName: "../escape", git: { worktreeList: async () => worktrees } }))
      .toMatchObject({ ok: false, kind: "no-worktree" });
  });
});

describe("setTaskDone", () => {
  const now = () => new Date(2026, 9, 5, 9, 30);

  it("ticks a task and changes nothing else on its line", async () => {
    const { worktree, worktrees } = await fixture();
    const result = await setTaskDone({
      repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees }, ...quiet,
      lineNumber: 2, expectedText: "Write the module.", done: true, now,
    });
    expect(result).toMatchObject({ ok: true, line: "- [x] 1.1 Write the module." });
    const text = await readFile(path.join(worktree, "openspec", "changes", "demo", "tasks.md"), "utf8");
    expect(text).toBe(TASKS.replace("- [ ] 1.1", "- [x] 1.1"));
  });

  it("writes a Human-only task's note under the lines that carry it on, so the gate counts it", async () => {
    const { worktree, worktrees } = await fixture();
    const result = await setTaskDone({
      repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees }, ...quiet,
      lineNumber: 3, expectedText: "1.2 **Human-only**: see it in the Pipeline, with", done: true,
      note: "seen in the Pipeline", by: "ada@example.com", now,
    });
    expect(result).toMatchObject({ ok: true, noteLine: "  Closed by ada@example.com on 2026-10-05: seen in the Pipeline" });
    const text = await readFile(path.join(worktree, "openspec", "changes", "demo", "tasks.md"), "utf8");
    expect(text.split("\n").slice(3, 6)).toEqual([
      "- [x] 1.2 **Human-only**: see it in the Pipeline, with",
      "  the card open.",
      "  Closed by ada@example.com on 2026-10-05: seen in the Pipeline",
    ]);
    expect(describeTaskDebts(parseTaskChecklist(text)).unrecorded).toEqual([]);
  });

  it("refuses to tick a Human-only task without a note, and writes nothing", async () => {
    const { worktree, worktrees } = await fixture();
    const result = await setTaskDone({
      repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees }, ...quiet,
      lineNumber: 3, expectedText: "1.2 **Human-only**: see it in the Pipeline, with", done: true, now,
    });
    expect(result).toMatchObject({ ok: false, kind: "note-required" });
    expect(await readFile(path.join(worktree, "openspec", "changes", "demo", "tasks.md"), "utf8")).toBe(TASKS);
  });

  it("reopens a task with a note saying so", async () => {
    const { worktree, worktrees } = await fixture();
    await setTaskDone({
      repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees }, ...quiet,
      lineNumber: 7, expectedText: "1.3 Already done.", done: false, note: "the test was wrong", by: "ada", now,
    });
    const lines = (await readFile(path.join(worktree, "openspec", "changes", "demo", "tasks.md"), "utf8")).split("\n");
    expect(lines.slice(7, 9)).toEqual(["- [ ] 1.3 Already done.", "  Reopened by ada on 2026-10-05: the test was wrong"]);
  });

  it("refuses a line that changed since it was shown, and a line that is no task", async () => {
    const { worktrees } = await fixture();
    const base = { repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees }, ...quiet, done: true, now };
    expect(await setTaskDone({ ...base, lineNumber: 2, expectedText: "Write the old module." })).toMatchObject({ ok: false, kind: "line-changed" });
    expect(await setTaskDone({ ...base, lineNumber: 0, expectedText: "## 1. Work" })).toMatchObject({ ok: false, kind: "not-a-task" });
  });

  it("refuses while a run holds the worktree, or a live record names the change there, naming it", async () => {
    const { worktree, worktrees } = await fixture();
    const base = {
      repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees },
      lineNumber: 2, expectedText: "Write the module.", done: true, now,
    };
    const leased = await setTaskDone({
      ...base,
      readLease: async () => ({ hostKind: "vscode-extension" as const, hostname: "box", pid: 42, heartbeatAgeMs: 1000 }),
      readStatuses: async () => [],
    });
    expect(leased).toMatchObject({ ok: false, kind: "run-working" });
    expect(leased.ok ? "" : leased.reason).toContain("pid 42");

    const recorded = await setTaskDone({
      ...base,
      readLease: async () => undefined,
      readStatuses: async () => [{ instanceId: "i9", changeName: "demo", workingDirectory: worktree, gone: false, activity: "running npm test" } as AgentStatusReport],
    });
    expect(recorded).toMatchObject({ ok: false, kind: "run-working" });
    expect(recorded.ok ? "" : recorded.reason).toContain("i9");
  });

  it("keeps a file's CRLF line endings", async () => {
    const { worktree, worktrees } = await fixture({ tasks: TASKS.replace(/\n/g, "\r\n") });
    await setTaskDone({
      repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees }, ...quiet,
      lineNumber: 3, expectedText: "1.2 **Human-only**: see it in the Pipeline, with", done: true, note: "seen", by: "ada", now,
    });
    const text = await readFile(path.join(worktree, "openspec", "changes", "demo", "tasks.md"), "utf8");
    expect(text.includes("\r\n")).toBe(true);
    expect(/[^\r]\n/.test(text)).toBe(false);
  });
});

describe("readChangeTaskRows", () => {
  it("reads the own worktree's rows whole, with their lines", async () => {
    const { worktree, worktrees } = await fixture();
    const rows = await readChangeTaskRows({ repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees } });
    expect(rows).toMatchObject({ source: "own-worktree", path: worktree });
    expect(rows.ok === false ? [] : (rows as { rows: unknown[] }).rows).toEqual([
      { number: "1.1", text: "Write the module.", section: "Work", lineNumber: 2, done: false, closedBy: "agent" },
      {
        number: "1.2",
        text: "**Human-only**: see it in the Pipeline, with",
        section: "Work",
        lineNumber: 3,
        body: "the card open.\n\nAn earlier remark after a blank line.",
        done: false,
        closedBy: "person",
      },
      { number: "1.3", text: "Already done.", section: "Work", lineNumber: 7, done: true, closedBy: "agent" },
    ]);
  });

  it("falls back to this checkout's copy, read-only, where there is no worktree of its own", async () => {
    const { root } = await fixture({ branch: "other" });
    const here = path.join(root, "main");
    await mkdir(path.join(here, "openspec", "changes", "demo"), { recursive: true });
    await writeFile(path.join(here, "openspec", "changes", "demo", "tasks.md"), "- [ ] 1.1 Here.\n", "utf8");
    const rows = await readChangeTaskRows({
      repositoryRoot: here,
      changeName: "demo",
      git: { worktreeList: async () => [{ path: here, branch: "main" }] },
    });
    expect(rows).toMatchObject({ source: "this-checkout", path: path.resolve(here) });
  });
});

describe("runOwnDelegatedItem", () => {
  it("refuses a change with no worktree of its own, and one a run is working in, before any runner is asked for", async () => {
    const { worktree, worktrees } = await fixture();
    const runnersFor = vi.fn(() => () => undefined);
    expect(await runOwnDelegatedItem({ repositoryRoot: "/repo", changeName: "nope", git: { worktreeList: async () => worktrees }, lineNumber: 3, runnersFor }))
      .toMatchObject({ ok: false, kind: "no-worktree" });
    expect(await runOwnDelegatedItem({
      repositoryRoot: "/repo", changeName: "demo", git: { worktreeList: async () => worktrees }, lineNumber: 3, runnersFor,
      readLease: async () => undefined,
      readStatuses: async () => [{ instanceId: "i1", changeName: "demo", workingDirectory: worktree, gone: false, activity: "x" } as AgentStatusReport],
    })).toMatchObject({ ok: false, kind: "run-working" });
    expect(runnersFor).not.toHaveBeenCalled();
  });
});

describe("taskListCommitMessage", () => {
  it("names the tasks ticked and reopened", () => {
    const diff = ["-- [ ] 6.4 Human-only", "+- [x] 6.4 Human-only", "-- [x] 2.1 Something", "+- [ ] 2.1 Something", "+  Closed by ada"].join("\n");
    expect(taskListCommitMessage("demo", diff)).toBe("tasks(demo): ticked 6.4; reopened 2.1");
    expect(taskListCommitMessage("demo", "+  a note only")).toBe("tasks(demo): update the task list");
  });
});
