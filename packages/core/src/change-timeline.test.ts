import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  blameLineDates,
  getChangeArchivedDate,
  getChangeAuthorship,
  getChangeTimeline,
  getFileCreatedDate,
} from "./change-timeline.js";

// Measured baseline on 2026-09-02 before this optimization: this file
// passed 14/14 in 14.7s and 16.1s on two idle runs. One repository-
// building test spawned 3 git processes for init/config plus 2 per
// commit. This file now removes per-repo addConfig spawns and sets an
// explicit per-test timeout with headroom over remaining real-git cost.
// Measured after these changes (isolated run, 2026-09-02): 14/14 in
// 15.31s test time (17.69s wall-clock reported by Vitest).
//
// every-varying-check-has-a-budget, 2026-09-05: the 15000 ms that figure
// bought was sized from an *isolated* run, and this file timed out three
// times at exactly 15000 ms under deliberate 8-worker CPU co-load. With
// the ceiling lifted its slowest single test took 42.3s across two such
// runs (20.9s in the other). Sized from that, not from the idle figure.
vi.setConfig({ testTimeout: 130_000 });

const temporaryRoots: string[] = [];
let sharedReadOnlyRepoRoot: string | undefined;

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-change-timeline-"));
  temporaryRoots.push(root);
  return root;
}

afterAll(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

// Shared only by tests that read from an unchanging "initialized repo"
// shape and never mutate it.
async function getSharedReadOnlyRepoRoot(): Promise<string> {
  if (sharedReadOnlyRepoRoot !== undefined) return sharedReadOnlyRepoRoot;
  const root = await temporaryRoot();
  await initRepo(root);
  sharedReadOnlyRepoRoot = root;
  return root;
}

async function initRepo(root: string): Promise<SimpleGit> {
  const git = simpleGit(root);
  await git.init();
  return git;
}

async function commitAll(root: string, message: string, isoDate: string): Promise<void> {
  const git = simpleGit(root).env({
    GIT_AUTHOR_DATE: isoDate,
    GIT_COMMITTER_DATE: isoDate,
    GIT_AUTHOR_NAME: "Test User",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test User",
    GIT_COMMITTER_EMAIL: "test@example.com",
  });
  await git.add(".");
  await git.commit(message);
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

async function writeChangeFiles(
  root: string,
  changeName: string,
  tasksContent: string,
  location: "changes" | "changes/archive" = "changes",
): Promise<string> {
  const changeDir = path.join(root, "openspec", location, changeName);
  await mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, "proposal.md"), "## Why\n\nBecause.\n");
  await writeFile(path.join(changeDir, "design.md"), "## Context\n\nSome context.\n");
  await writeFile(path.join(changeDir, "tasks.md"), tasksContent);
  return changeDir;
}

describe("blameLineDates", () => {
  it("returns undefined when git blame fails (not a repo)", async () => {
    const root = await temporaryRoot();
    await writeFile(path.join(root, "tasks.md"), "- [x] a\n");

    expect(await blameLineDates(root, path.join(root, "tasks.md"))).toBeUndefined();
  });

  it("attributes different commits to different dates, and one commit to all its lines", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    const tasksPath = path.join(root, "tasks.md");
    await writeFile(tasksPath, "- [ ] first\n- [ ] second\n- [ ] third\n");
    await commitAll(root, "add tasks", "2026-01-01T00:00:00Z");

    await writeFile(tasksPath, "- [x] first\n- [ ] second\n- [ ] third\n");
    await commitAll(root, "check first", "2026-01-02T00:00:00Z");

    await writeFile(tasksPath, "- [x] first\n- [x] second\n- [x] third\n");
    await commitAll(root, "check second and third together", "2026-01-03T00:00:00Z");

    const dates = await blameLineDates(root, tasksPath);

    expect(dates?.get(0)).toBe("2026-01-02T00:00:00.000Z");
    expect(dates?.get(1)).toBe("2026-01-03T00:00:00.000Z");
    expect(dates?.get(2)).toBe(dates?.get(1));
  });
});

describe("getFileCreatedDate", () => {
  it("returns the earliest commit date that added the file", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    const filePath = path.join(root, "proposal.md");
    await writeFile(filePath, "## Why\n");
    await commitAll(root, "add proposal", "2026-01-01T00:00:00Z");
    await writeFile(filePath, "## Why\n\nUpdated.\n");
    await commitAll(root, "update proposal", "2026-01-05T00:00:00Z");

    expect(await getFileCreatedDate(root, filePath)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns null when the file was never committed", async () => {
    const root = await getSharedReadOnlyRepoRoot();

    expect(await getFileCreatedDate(root, path.join(root, "never-committed.md"))).toBeNull();
  });
});

describe("getChangeArchivedDate", () => {
  it("parses the date prefix for an archived change", () => {
    expect(getChangeArchivedDate("2026-08-26-add-cli-help-flag", true)).toBe("2026-08-26");
  });

  it("returns null for an active change", () => {
    expect(getChangeArchivedDate("2026-08-26-add-cli-help-flag", false)).toBeNull();
  });

  it("returns null when the folder name has no date prefix", () => {
    expect(getChangeArchivedDate("add-cli-help-flag", true)).toBeNull();
  });
});

describe("getChangeAuthorship", () => {
  it("returns empty authorship when git fails (not a repo)", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec", "changes", "my-change"), { recursive: true });

    const authorship = await getChangeAuthorship(root, path.join(root, "openspec", "changes", "my-change"));

    expect(authorship).toEqual({ primaryAuthor: null, contributors: [] });
  });

  it("attributes the primary author to the most recent commit touching the directory", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    const changeDir = await writeChangeFiles(root, "my-change", "- [ ] first\n");
    await commitAllAs(root, "create change", "2026-01-01T00:00:00Z", "Alice", "alice@example.com");
    await writeFile(path.join(changeDir, "tasks.md"), "- [x] first\n");
    await commitAllAs(root, "complete task", "2026-01-05T00:00:00Z", "Bob", "bob@example.com");

    const authorship = await getChangeAuthorship(root, changeDir);

    expect(authorship.primaryAuthor).toEqual({
      name: "Bob",
      email: "bob@example.com",
      date: "2026-01-05T00:00:00.000Z",
    });
  });

  it("lists every distinct contributor, oldest to newest, deduplicated by email", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    const changeDir = await writeChangeFiles(root, "my-change", "- [ ] first\n- [ ] second\n");
    await commitAllAs(root, "create change", "2026-01-01T00:00:00Z", "Alice", "alice@example.com");
    await writeFile(path.join(changeDir, "tasks.md"), "- [x] first\n- [ ] second\n");
    await commitAllAs(root, "complete first", "2026-01-02T00:00:00Z", "Bob", "bob@example.com");
    await writeFile(path.join(changeDir, "tasks.md"), "- [x] first\n- [x] second\n");
    await commitAllAs(root, "complete second", "2026-01-03T00:00:00Z", "Alice", "alice@example.com");

    const authorship = await getChangeAuthorship(root, changeDir);

    expect(authorship.contributors.map((c) => c.email)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("returns empty authorship when the directory has no history", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "committed-change", "- [ ] first\n");
    await commitAllAs(root, "create change", "2026-01-01T00:00:00Z", "Alice", "alice@example.com");
    const uncommittedDir = path.join(root, "openspec", "changes", "never-committed");
    await mkdir(uncommittedDir, { recursive: true });

    const authorship = await getChangeAuthorship(root, uncommittedDir);

    expect(authorship).toEqual({ primaryAuthor: null, contributors: [] });
  });
});

describe("getChangeTimeline", () => {
  it("merges task dates, created date, and markdown content for an active change", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "my-change", "- [ ] first\n- [ ] second\n");
    await commitAll(root, "create change", "2026-01-01T00:00:00Z");
    await writeFile(
      path.join(root, "openspec", "changes", "my-change", "tasks.md"),
      "- [x] first\n- [ ] second\n",
    );
    await commitAll(root, "complete first task", "2026-01-02T00:00:00Z");

    const timeline = await getChangeTimeline(root, "my-change", false);

    expect(timeline.changeName).toBe("my-change");
    expect(timeline.archived).toBe(false);
    expect(timeline.archivedDate).toBeNull();
    expect(timeline.createdDate).toBe("2026-01-01T00:00:00.000Z");
    expect(timeline.proposal).toContain("Because.");
    expect(timeline.design).toContain("Some context.");
    expect(timeline.tasks).toEqual([
      {
        lineNumber: 0,
        text: "first",
        done: true,
        date: "2026-01-02T00:00:00.000Z",
        lastTouchedDate: "2026-01-02T00:00:00.000Z",
      },
      {
        lineNumber: 1,
        text: "second",
        done: false,
        date: null,
        lastTouchedDate: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("resolves the archived date from the folder name and still blames tasks after the move", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "my-change", "- [ ] only\n");
    await commitAll(root, "create change", "2026-01-01T00:00:00Z");
    await writeFile(
      path.join(root, "openspec", "changes", "my-change", "tasks.md"),
      "- [x] only\n",
    );
    await commitAll(root, "complete task", "2026-01-02T00:00:00Z");

    const archiveDir = path.join(root, "openspec", "changes", "archive");
    await mkdir(archiveDir, { recursive: true });
    await rename(
      path.join(root, "openspec", "changes", "my-change"),
      path.join(archiveDir, "2026-01-03-my-change"),
    );
    await commitAll(root, "archive change", "2026-01-03T00:00:00Z");

    const timeline = await getChangeTimeline(root, "2026-01-03-my-change", true);

    expect(timeline.archived).toBe(true);
    expect(timeline.archivedDate).toBe("2026-01-03");
    expect(timeline.tasks).toEqual([
      {
        lineNumber: 0,
        text: "only",
        done: true,
        date: "2026-01-02T00:00:00.000Z",
        lastTouchedDate: "2026-01-02T00:00:00.000Z",
      },
    ]);
  });

  it("returns empty content and no tasks for a change that does not exist", async () => {
    const root = await getSharedReadOnlyRepoRoot();

    const timeline = await getChangeTimeline(root, "missing-change", false);

    expect(timeline.proposal).toBe("");
    expect(timeline.design).toBe("");
    expect(timeline.specs).toEqual([]);
    expect(timeline.tasks).toEqual([]);
    expect(timeline.createdDate).toBeNull();
  });
});
