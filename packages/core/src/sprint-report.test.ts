import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";
import { afterAll, describe, expect, it, vi } from "vitest";
import { buildSprintReport } from "./sprint-report.js";

// Measured baseline on 2026-09-02 before this optimization: this file
// intermittently timed out under co-load at Vitest's 5000ms default,
// with the dominant cost coming from many git process spawns while
// building fixtures. This file now avoids per-repo addConfig subprocesses
// and sets an explicit per-test timeout with headroom for real-git work.
// Measured after these changes (isolated run, 2026-09-02): 5/5 in 8.68s
// test time (11.32s wall-clock reported by Vitest).
vi.setConfig({ testTimeout: 15000 });

const temporaryRoots: string[] = [];
let sharedReadOnlyRepoRoot: string | undefined;

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-sprint-report-"));
  temporaryRoots.push(root);
  return root;
}

afterAll(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

// Shared only by tests that read from the same committed history and do
// not mutate it.
async function getSharedReadOnlyRepoRoot(): Promise<string> {
  if (sharedReadOnlyRepoRoot !== undefined) return sharedReadOnlyRepoRoot;
  const root = await temporaryRoot();
  await initRepo(root);
  await writeChangeFiles(root, "old-change", "- [ ] a\n");
  await commitAllAs(root, "create", "2025-01-01T00:00:00Z", "Alice", "alice@example.com");
  sharedReadOnlyRepoRoot = root;
  return root;
}

async function initRepo(root: string): Promise<SimpleGit> {
  const git = simpleGit(root);
  await git.init();
  return git;
}

async function commitAllAs(
  root: string,
  message: string,
  isoDate: string,
  authorName: string,
  authorEmail: string,
): Promise<void> {
  const git = simpleGit(root).env({
    GIT_AUTHOR_DATE: isoDate,
    GIT_COMMITTER_DATE: isoDate,
    GIT_AUTHOR_NAME: authorName,
    GIT_AUTHOR_EMAIL: authorEmail,
    GIT_COMMITTER_NAME: authorName,
    GIT_COMMITTER_EMAIL: authorEmail,
  });
  await git.add(".");
  await git.commit(message);
}

async function writeChangeFiles(root: string, changeName: string, tasksContent: string): Promise<string> {
  const changeDir = path.join(root, "openspec", "changes", changeName);
  await mkdir(changeDir, { recursive: true });
  await writeFile(
    path.join(changeDir, "proposal.md"),
    "## Why\n\nThis is the reason this change exists, in enough detail to summarize.\n\n## What Changes\n\n- Something else entirely, not part of the summary.\n",
  );
  await writeFile(path.join(changeDir, "design.md"), "");
  await writeFile(path.join(changeDir, "tasks.md"), tasksContent);
  return changeDir;
}

describe("buildSprintReport", () => {
  it("aggregates authorship, task counts, and a plain-text Why summary per change", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    const changeDir = await writeChangeFiles(root, "change-one", "- [ ] first\n- [ ] second\n");
    await commitAllAs(root, "create change-one", "2026-01-01T00:00:00Z", "Alice", "alice@example.com");
    await writeFile(path.join(changeDir, "tasks.md"), "- [x] first\n- [ ] second\n");
    await commitAllAs(root, "complete first", "2026-01-05T00:00:00Z", "Alice", "alice@example.com");

    const report = await buildSprintReport(
      root,
      [{ changeName: "change-one", archived: false }],
      "2026-01-01T00:00:00.000Z",
      "2026-01-10T00:00:00.000Z",
    );

    expect(report.entries).toHaveLength(1);
    const entry = report.entries[0];
    expect(entry?.changeName).toBe("change-one");
    expect(entry?.completedTaskCount).toBe(1);
    expect(entry?.totalTaskCount).toBe(2);
    expect(entry?.tasksCompletedInRange).toBe(1);
    expect(entry?.primaryAuthor).toEqual({
      name: "Alice",
      email: "alice@example.com",
      date: "2026-01-05T00:00:00.000Z",
    });
    expect(entry?.whySummary).toBe("This is the reason this change exists, in enough detail to summarize.");
    expect(entry?.whySummary).not.toContain("Something else entirely");
  });

  it("only counts tasks completed within the requested range toward the sprint stats", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    const changeDir = await writeChangeFiles(root, "change-one", "- [ ] a\n- [ ] b\n");
    await commitAllAs(root, "create", "2026-01-01T00:00:00Z", "Alice", "alice@example.com");
    await writeFile(path.join(changeDir, "tasks.md"), "- [x] a\n- [ ] b\n");
    await commitAllAs(root, "complete a inside range", "2026-01-05T00:00:00Z", "Alice", "alice@example.com");
    await writeFile(path.join(changeDir, "tasks.md"), "- [x] a\n- [x] b\n");
    await commitAllAs(root, "complete b outside range", "2026-02-15T00:00:00Z", "Alice", "alice@example.com");

    const report = await buildSprintReport(
      root,
      [{ changeName: "change-one", archived: false }],
      "2026-01-01T00:00:00.000Z",
      "2026-01-10T00:00:00.000Z",
    );

    // Both tasks are done (change still appears with its real totals)...
    expect(report.entries[0]?.completedTaskCount).toBe(2);
    // ...but only the one completed inside the range counts toward the sprint.
    expect(report.entries[0]?.tasksCompletedInRange).toBe(1);
    expect(report.stats.totalTasksCompletedInRange).toBe(1);
  });

  it("keeps a selected change in the report even if it started before the range", async () => {
    const root = await getSharedReadOnlyRepoRoot();

    const report = await buildSprintReport(
      root,
      [{ changeName: "old-change", archived: false }],
      "2026-01-01T00:00:00.000Z",
      "2026-01-10T00:00:00.000Z",
    );

    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]?.changeName).toBe("old-change");
  });

  it("ranks changesByAuthor by count, descending", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "change-a", "- [ ] a\n");
    await commitAllAs(root, "create a", "2026-01-01T00:00:00Z", "Alice", "alice@example.com");
    await writeChangeFiles(root, "change-b", "- [ ] b\n");
    await commitAllAs(root, "create b", "2026-01-02T00:00:00Z", "Bob", "bob@example.com");
    await writeChangeFiles(root, "change-c", "- [ ] c\n");
    await commitAllAs(root, "create c", "2026-01-03T00:00:00Z", "Alice", "alice@example.com");

    const report = await buildSprintReport(
      root,
      [
        { changeName: "change-a", archived: false },
        { changeName: "change-b", archived: false },
        { changeName: "change-c", archived: false },
      ],
      "2026-01-01T00:00:00.000Z",
      "2026-01-10T00:00:00.000Z",
    );

    expect(report.stats.totalChanges).toBe(3);
    // The stored `author` snapshot per entry is from the first change
    // processed for that author (change-a for Alice, in entry order) —
    // only the count accumulates across later changes by the same author.
    expect(report.stats.changesByAuthor).toEqual([
      { author: { name: "Alice", email: "alice@example.com", date: "2026-01-01T00:00:00.000Z" }, count: 2 },
      { author: { name: "Bob", email: "bob@example.com", date: "2026-01-02T00:00:00.000Z" }, count: 1 },
    ]);
  });

  it("returns an empty report for no entries", async () => {
    const root = await getSharedReadOnlyRepoRoot();

    const report = await buildSprintReport(root, [], "2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z");

    expect(report.entries).toEqual([]);
    expect(report.stats).toEqual({ totalChanges: 0, totalTasksCompletedInRange: 0, changesByAuthor: [] });
  });
});
