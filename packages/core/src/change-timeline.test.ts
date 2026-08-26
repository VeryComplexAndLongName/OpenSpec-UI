import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";
import { afterEach, describe, expect, it } from "vitest";
import {
  blameLineDates,
  getChangeArchivedDate,
  getChangeTimeline,
  getFileCreatedDate,
} from "./change-timeline.js";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-change-timeline-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function initRepo(root: string): Promise<SimpleGit> {
  const git = simpleGit(root);
  await git.init();
  await git.addConfig("user.email", "test@example.com");
  await git.addConfig("user.name", "Test User");
  return git;
}

async function commitAll(root: string, message: string, isoDate: string): Promise<void> {
  const git = simpleGit(root).env({ GIT_AUTHOR_DATE: isoDate, GIT_COMMITTER_DATE: isoDate });
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
    const root = await temporaryRoot();
    await initRepo(root);

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
      { lineNumber: 0, text: "first", done: true, date: "2026-01-02T00:00:00.000Z" },
      { lineNumber: 1, text: "second", done: false, date: null },
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
      { lineNumber: 0, text: "only", done: true, date: "2026-01-02T00:00:00.000Z" },
    ]);
  });

  it("returns empty content and no tasks for a change that does not exist", async () => {
    const root = await temporaryRoot();
    await initRepo(root);

    const timeline = await getChangeTimeline(root, "missing-change", false);

    expect(timeline.proposal).toBe("");
    expect(timeline.design).toBe("");
    expect(timeline.specs).toEqual([]);
    expect(timeline.tasks).toEqual([]);
    expect(timeline.createdDate).toBeNull();
  });
});
