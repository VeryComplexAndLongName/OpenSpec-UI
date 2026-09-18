import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import simpleGit from "simple-git";
import { afterAll, describe, expect, it, vi } from "vitest";
import { readChangeSpans, type ChangeSpan } from "./change-spans.js";
import { getFileCreatedDate } from "./change-timeline.js";
import { gitIsolationOptions } from "./test-support/git-isolation.js";

// Cost-varying: every case here builds a git repository and commits to
// it, and the last one reads the same dates twice, once per read.
// Budgeted at the ceiling `change-timeline.test.ts` settled on for the
// same kind of work — a budget sized from an idle run reports a busy
// machine as a failure (LIMITS.md, "a budget is a ceiling, not a
// target").
vi.setConfig({ testTimeout: 130_000 });

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-change-spans-"));
  roots.push(root);
  await mkdir(path.join(root, "openspec", "changes"), { recursive: true });
  await writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  return root;
}

async function initRepo(root: string): Promise<void> {
  await simpleGit(root, await gitIsolationOptions()).init();
}

async function commitAll(root: string, message: string, isoDate: string): Promise<void> {
  const git = simpleGit(root, await gitIsolationOptions()).env({
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

async function writeChange(
  root: string,
  changeName: string,
  tasks: string | undefined,
  location: "changes" | "changes/archive" = "changes",
): Promise<string> {
  const directory = path.join(root, "openspec", location, changeName);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "proposal.md"), "## Why\n\nBecause.\n", "utf8");
  if (tasks !== undefined) await writeFile(path.join(directory, "tasks.md"), tasks, "utf8");
  return directory;
}

function spanOf(spans: ChangeSpan[], changeName: string): ChangeSpan {
  const span = spans.find((candidate) => candidate.changeName === changeName);
  if (!span) throw new Error(`no span for ${changeName}: ${spans.map((s) => s.changeName).join(", ")}`);
  return span;
}

describe("readChangeSpans", () => {
  it("returns every change with both dates, their sources and its task counts", async () => {
    const root = await workspace();
    await initRepo(root);
    await writeChange(root, "first-change", "## Tasks\n\n- [x] one\n- [x] two\n- [ ] three\n");
    await commitAll(root, "propose first", "2026-03-01T10:00:00Z");
    await writeChange(root, "second-change", "## Tasks\n\n- [ ] one\n");
    await commitAll(root, "propose second", "2026-03-02T11:00:00Z");
    await mkdir(path.join(root, "openspec", "changes", "archive"), { recursive: true });
    await rename(
      path.join(root, "openspec", "changes", "first-change"),
      path.join(root, "openspec", "changes", "archive", "2026-03-04-first-change"),
    );
    await commitAll(root, "archive first", "2026-03-04T16:00:00Z");

    const { spans, readAt } = await readChangeSpans(root);

    expect(spans).toHaveLength(2);
    expect(Number.isNaN(Date.parse(readAt))).toBe(false);

    const archived = spanOf(spans, "2026-03-04-first-change");
    expect(archived.archived).toBe(true);
    expect(archived.dates.proposed).toMatchObject({ day: "2026-03-01", source: "git-commit" });
    // Dated from the commit that moved it, not from the folder's prefix
    // — which here says the same day, and says it from a convention.
    expect(archived.dates.archived).toMatchObject({ day: "2026-03-04", source: "git-commit" });
    expect(archived.tasks).toEqual({ done: 2, total: 3 });

    const active = spanOf(spans, "second-change");
    expect(active.archived).toBe(false);
    expect(active.dates.proposed).toMatchObject({ day: "2026-03-02", source: "git-commit" });
    expect(active.dates.archived).toMatchObject({ date: null, source: "none" });
    expect(active.tasks).toEqual({ done: 0, total: 1 });
  });

  it("carries an absent proposed date for a change nobody has committed", async () => {
    const root = await workspace();
    await initRepo(root);
    await writeChange(root, "committed-change", "## Tasks\n\n- [x] one\n");
    await commitAll(root, "propose committed", "2026-03-01T10:00:00Z");
    await writeChange(root, "working-tree-change", "## Tasks\n\n- [ ] one\n");

    const { spans } = await readChangeSpans(root);

    const uncommitted = spanOf(spans, "working-tree-change");
    expect(uncommitted.dates.proposed).toEqual({ date: null, day: null, source: "none" });
    // Its list is on disk and is read: what is missing is the commit.
    expect(uncommitted.tasks).toEqual({ done: 0, total: 1 });
    expect(spanOf(spans, "committed-change").dates.proposed.source).toBe("git-commit");
  });

  it("carries no counts for a change with no task list", async () => {
    const root = await workspace();
    await initRepo(root);
    await writeChange(root, "no-tasks-change", undefined);
    await commitAll(root, "propose", "2026-03-01T10:00:00Z");

    const { spans } = await readChangeSpans(root);

    expect(spanOf(spans, "no-tasks-change").tasks).toBeNull();
  });

  it("returns every change with absent dates when the workspace has no history", async () => {
    const root = await workspace();
    await writeChange(root, "unversioned-change", "## Tasks\n\n- [x] one\n");

    const { spans } = await readChangeSpans(root);

    expect(spans).toHaveLength(1);
    const span = spanOf(spans, "unversioned-change");
    expect(span.dates.proposed.source).toBe("none");
    expect(span.tasks).toEqual({ done: 1, total: 1 });
  });

  it("dates an archived change from its folder name where no commit moved it", async () => {
    const root = await workspace();
    await initRepo(root);
    await writeChange(root, "2026-03-09-moved-by-hand", "## Tasks\n\n- [x] one\n", "changes/archive");
    await commitAll(root, "add an archived change directly", "2026-03-10T09:00:00Z");

    const { spans } = await readChangeSpans(root);

    const span = spanOf(spans, "2026-03-09-moved-by-hand");
    // The prefix, and it says so: the commit that added the directory is
    // when it appeared *there*, which for a change moved by hand is the
    // archiving commit — so the commit wins, and this asserts that the
    // source is stated either way.
    expect(span.dates.archived.source).toBe("git-commit");
    expect(span.dates.archived.day).toBe("2026-03-10");
  });

  it("dates a renamed change from the add at its current path, where the per-change read follows the rename", async () => {
    const root = await workspace();
    await initRepo(root);
    await writeChange(root, "first-name", "## Tasks\n\n- [x] one\n");
    await commitAll(root, "propose under its first name", "2026-03-01T10:00:00Z");
    await rename(
      path.join(root, "openspec", "changes", "first-name"),
      path.join(root, "openspec", "changes", "second-name"),
    );
    await commitAll(root, "rename the change", "2026-03-01T14:00:00Z");

    const { spans } = await readChangeSpans(root);
    const followed = await getFileCreatedDate(
      root,
      path.join(root, "openspec", "changes", "second-name", "proposal.md"),
    );

    // The difference the two reads are allowed to have, and the reason
    // the one-change screen keeps `--follow`: this pass reports when
    // `proposal.md` appeared at the change's own path, the per-change
    // read follows it back to the first draft. Both are commits, and
    // this repository's 264 changes differ in two of them.
    const span = spanOf(spans, "second-name");
    expect(span.dates.proposed.source).toBe("git-commit");
    expect(span.dates.proposed.date).toBe("2026-03-01T14:00:00.000Z");
    expect(followed).toBe("2026-03-01T10:00:00Z");
    expect(span.dates.proposed.day).toBe("2026-03-01");
  });
});
