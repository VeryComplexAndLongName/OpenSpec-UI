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
  getChangeTimelines,
  getFileCreatedDate,
  getPathAddedDate,
  readArchiveCommitDates,
} from "./change-timeline.js";
import { gitIsolationOptions } from "./test-support/git-isolation.js";

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
  // Isolated from the machine's git configuration, like every other call
  // here — see test-support/git-isolation.ts.
  const git = simpleGit(root, await gitIsolationOptions());
  await git.init();
  return git;
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

async function commitAllAs(
  root: string,
  message: string,
  isoDate: string,
  authorName: string,
  authorEmail: string,
): Promise<void> {
  const git = simpleGit(root, await gitIsolationOptions()).env({
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

    // The offset git recorded, not a normalisation of it: the day is
    // read from this string, and normalising here is what moved an
    // after-midnight commit to the day before.
    expect(dates?.get(0)).toBe("2026-01-02T00:00:00+00:00");
    expect(dates?.get(1)).toBe("2026-01-03T00:00:00+00:00");
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

    expect(await getFileCreatedDate(root, filePath)).toBe("2026-01-01T00:00:00Z");
  });

  it("returns null when the file was never committed", async () => {
    const root = await getSharedReadOnlyRepoRoot();

    expect(await getFileCreatedDate(root, path.join(root, "never-committed.md"))).toBeNull();
  });
});

describe("getPathAddedDate, and the pair that dates an archived change", () => {
  // change-dates-from-evidence. The two calls differ by one flag, and
  // the difference is the whole point: `--follow` reports when the file
  // first existed anywhere, without it when it appeared *there*.

  it("dates a change's proposal and its archiving from two commits, not from a folder name", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    const active = path.join(root, "openspec", "changes", "demo");
    await mkdir(active, { recursive: true });
    await writeFile(path.join(active, "proposal.md"), "## Why\n");
    await commitAll(root, "propose demo", "2026-03-01T10:00:00Z");

    // What `openspec archive` does: a rename into `archive/` with a
    // dated prefix.
    const archived = path.join(root, "openspec", "changes", "archive", "2026-03-04-demo");
    await mkdir(path.dirname(archived), { recursive: true });
    await rename(active, archived);
    await commitAll(root, "archive demo", "2026-03-04T15:00:00Z");

    const proposalPath = path.join(archived, "proposal.md");
    // Followed through the rename: when it was proposed.
    expect(await getFileCreatedDate(root, proposalPath)).toBe("2026-03-01T10:00:00Z");
    // Not followed: when it appeared under `archive/`.
    expect(await getPathAddedDate(root, proposalPath)).toBe("2026-03-04T15:00:00Z");
  });

  it("reads every archived change's date in one call", async () => {
    // One call for the whole directory rather than one per change:
    // measured on this repository at 0.5s against 80 seconds.
    const root = await temporaryRoot();
    await initRepo(root);
    const active = path.join(root, "openspec", "changes", "demo");
    await mkdir(active, { recursive: true });
    await writeFile(path.join(active, "proposal.md"), "## Why\n");
    await commitAll(root, "propose demo", "2026-03-01T10:00:00Z");
    const archived = path.join(root, "openspec", "changes", "archive", "2026-03-04-demo");
    await mkdir(path.dirname(archived), { recursive: true });
    await rename(active, archived);
    await commitAll(root, "archive demo", "2026-03-04T15:00:00Z");

    const read = await readArchiveCommitDates(root);

    expect(read.dates.get("2026-03-04-demo")).toBe("2026-03-04T15:00:00Z");
    expect(read.unreadableLines).toBe(0);
  });

  it("returns an empty map where there is no archive to read", async () => {
    const root = await getSharedReadOnlyRepoRoot();

    expect((await readArchiveCommitDates(root)).dates.size).toBe(0);
  });

  it("reads the archive of a workspace nested under a directory named Core", async () => {
    // a-date-is-one-day-in-every-source, 4.3. `--name-only` prints
    // paths relative to the *repository* root, and this told a date
    // line from a path line by `line.startsWith("C")` — so every path
    // under a directory beginning with `C` was parsed as a date, the
    // parse threw inside the `try`, and the map came back short. Every
    // affected change then fell through to the per-change call
    // measured at 80 seconds, with its source still correct: a
    // regression nothing reported.
    const repoRoot = await temporaryRoot();
    await initRepo(repoRoot);
    const workspaceRoot = path.join(repoRoot, "Core");
    const active = path.join(workspaceRoot, "openspec", "changes", "nested");
    await mkdir(active, { recursive: true });
    await writeFile(path.join(active, "proposal.md"), "## Why\n");
    await commitAll(repoRoot, "propose nested", "2026-03-01T10:00:00Z");
    const archived = path.join(workspaceRoot, "openspec", "changes", "archive", "2026-03-04-nested");
    await mkdir(path.dirname(archived), { recursive: true });
    await rename(active, archived);
    await commitAll(repoRoot, "archive nested", "2026-03-04T15:00:00Z");

    const read = await readArchiveCommitDates(workspaceRoot);

    expect(read.dates.get("2026-03-04-nested")).toBe("2026-03-04T15:00:00Z");
    expect(read.unreadableLines).toBe(0);
  });

  it("returns null for a path git knows nothing about", async () => {
    const root = await getSharedReadOnlyRepoRoot();

    expect(await getPathAddedDate(root, path.join(root, "never-committed.md"))).toBeNull();
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

describe("getChangeTimeline — when the work happened", () => {
  // work-dates-are-evidence-of-work. This was every blame date on
  // `tasks.md`, which is added by the same commit as `proposal.md` — so
  // it reported the proposal date under another name, measured at
  // exactly zero days after it for all 185 changes in this repository.

  it("dates the work from the ticks, not from the day the list was written", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "worked-later", "- [ ] first\n- [ ] second\n");
    await commitAll(root, "propose", "2026-02-01T00:00:00Z");
    await writeFile(
      path.join(root, "openspec", "changes", "worked-later", "tasks.md"),
      "- [x] first\n- [ ] second\n",
    );
    await commitAll(root, "finish the first", "2026-02-03T00:00:00Z");
    await writeFile(
      path.join(root, "openspec", "changes", "worked-later", "tasks.md"),
      "- [x] first\n- [x] second\n",
    );
    await commitAll(root, "finish the second", "2026-02-05T00:00:00Z");

    const timeline = await getChangeTimeline(root, "worked-later", false);

    expect(timeline.dates.proposed.date).toBe("2026-02-01T00:00:00.000Z");
    // Two days after it was proposed, which is the span the old
    // definition could never report.
    expect(timeline.dates.firstWorked)
      .toEqual({ date: "2026-02-03T00:00:00.000Z", day: "2026-02-03", source: "git-blame" });
    expect(timeline.dates.lastWorked)
      .toEqual({ date: "2026-02-05T00:00:00.000Z", day: "2026-02-05", source: "git-blame" });
  });

  it("carries no work dates for a task list nobody has finished anything in", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "written-only", "- [ ] first\n- [ ] second\n");
    await commitAll(root, "propose", "2026-02-01T00:00:00Z");

    const timeline = await getChangeTimeline(root, "written-only", false);

    expect(timeline.dates.proposed.date).toBe("2026-02-01T00:00:00.000Z");
    expect(timeline.dates.firstWorked).toEqual({ date: null, day: null, source: "none" });
  });

  it("dates the work from a run recorded before the first tick", async () => {
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "ran-first", "- [ ] first\n");
    await commitAll(root, "propose", "2026-02-01T00:00:00Z");
    await writeFile(path.join(root, "openspec", "changes", "ran-first", "tasks.md"), "- [x] first\n");
    await commitAll(root, "finish", "2026-02-05T00:00:00Z");

    const timeline = await getChangeTimeline(root, "ran-first", false, {
      auditTimestamps: ["2026-02-02T09:00:00.000Z"],
    });

    // An agent ran two days before anyone checked a box, and that is
    // when work started.
    expect(timeline.dates.firstWorked)
      .toEqual({ date: "2026-02-02T09:00:00.000Z", day: "2026-02-02", source: "audit-log" });
  });

  it("dates the work from a run when the host passes the audit log to the batch call", async () => {
    // a-date-is-one-day-in-every-source, 2.2. `getChangeTimeline` took
    // audit timestamps and `getChangeTimelines` had no way to pass
    // them, and `getChangeTimelines` is the only production entry from
    // either host — so this source existed in the two tests above and
    // in no workspace anyone could open.
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "ran-first-too", "- [ ] first\n");
    await commitAll(root, "propose", "2026-02-01T00:00:00Z");
    await writeFile(path.join(root, "openspec", "changes", "ran-first-too", "tasks.md"), "- [x] first\n");
    await commitAll(root, "finish", "2026-02-05T00:00:00Z");

    const timelines = await getChangeTimelines(root, [{ changeName: "ran-first-too", archived: false }], {
      auditTimestampsByChange: new Map([["ran-first-too", ["2026-02-02T09:00:00.000Z"]]]),
    });

    expect(timelines[0]?.dates.firstWorked.source).toBe("audit-log");
    expect(timelines[0]?.dates.firstWorked.date).toBe("2026-02-02T09:00:00.000Z");
  });

  it("finds an archived change's runs under the name it had when they were recorded", async () => {
    // The audit log holds the change's directory as it was at the time,
    // and archiving renames it. Looking an archived change up by its
    // dated name alone would find nothing, which is the same defect one
    // level down.
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "2026-02-06-was-active", "- [x] only\n", "changes/archive");
    await commitAll(root, "archive it", "2026-02-06T00:00:00Z");

    const timelines = await getChangeTimelines(root, [
      { changeName: "2026-02-06-was-active", archived: true },
    ], {
      auditTimestampsByChange: new Map([["was-active", ["2026-02-02T09:00:00.000Z"]]]),
    });

    expect(timelines[0]?.dates.firstWorked.source).toBe("audit-log");
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

  it("resolves the archived date from the archiving commit and still blames tasks after the move", async () => {
    // The folder says one day and the commit that moved it says
    // another. The commit is the measurement, and it wins — this test
    // was named for the folder-name path and committed the archive on
    // exactly the folder's date, so it passed through the commit path
    // and never reached the fallback it claimed to cover. The fallback
    // has its own test below. See a-date-is-one-day-in-every-source.
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
    await commitAll(root, "archive change", "2026-01-05T00:00:00Z");

    const timeline = await getChangeTimeline(root, "2026-01-03-my-change", true);

    expect(timeline.archived).toBe(true);
    expect(timeline.dates.archived.source).toBe("git-commit");
    expect(timeline.archivedDate).toBe("2026-01-05");
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

  it("falls back to the folder name when no commit moved the change", async () => {
    // a-date-is-one-day-in-every-source, 6.1. A change moved under
    // `archive/` by hand and not committed: there is no commit to date
    // the archiving by, so the folder answers and says so.
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "moved-by-hand", "- [x] only\n");
    await commitAll(root, "create change", "2026-01-01T00:00:00Z");

    const archiveDir = path.join(root, "openspec", "changes", "archive");
    await mkdir(archiveDir, { recursive: true });
    await rename(
      path.join(root, "openspec", "changes", "moved-by-hand"),
      path.join(archiveDir, "2026-01-03-moved-by-hand"),
    );

    const timeline = await getChangeTimeline(root, "2026-01-03-moved-by-hand", true);

    expect(timeline.dates.archived.source).toBe("folder-name");
    expect(timeline.archivedDate).toBe("2026-01-03");
  });

  it("gives an after-midnight archive the day its own record names", async () => {
    // a-date-is-one-day-in-every-source, 1.3. Normalised to UTC this
    // commit is the 26th at 23:30, and the directory the same command
    // named says the 27th. Two sources, one action, one day.
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "late-night", "- [x] only\n", "changes/archive");
    await rename(
      path.join(root, "openspec", "changes", "archive", "late-night"),
      path.join(root, "openspec", "changes", "archive", "2026-08-27-late-night"),
    );
    await commitAll(root, "archive after midnight", "2026-08-27T02:30:00+03:00");

    const fromCommit = await getChangeTimeline(root, "2026-08-27-late-night", true);

    expect(fromCommit.dates.archived.source).toBe("git-commit");
    // The instant is kept as it always was — the offset only decides
    // which day it is called.
    expect(fromCommit.dates.archived.date).toBe("2026-08-26T23:30:00.000Z");
    expect(fromCommit.dates.archived.day).toBe("2026-08-27");
    expect(fromCommit.archivedDate).toBe("2026-08-27");
  });

  it("returns every other change's dates when one folder name is not a date", async () => {
    // a-date-is-one-day-in-every-source, 3.2. `new Date("2026-13-01T…")
    // .toISOString()` throws, and it threw through `buildChangeDates`
    // and out of the whole multi-change request: one hand-moved folder
    // with a typo rejected the timeline for every change beside it.
    const root = await temporaryRoot();
    await initRepo(root);
    await writeChangeFiles(root, "sound-change", "- [x] only\n");
    await commitAll(root, "a change with a readable history", "2026-03-01T10:00:00Z");
    // Written after the commit, so nothing dates it but its own name —
    // a folder moved by hand, with a typo in the prefix.
    await writeChangeFiles(root, "2026-13-01-typo", "- [x] only\n", "changes/archive");

    const timelines = await getChangeTimelines(root, [
      { changeName: "2026-13-01-typo", archived: true },
      { changeName: "sound-change", archived: false },
    ]);

    const typo = timelines.find((timeline) => timeline.changeName === "2026-13-01-typo");
    expect(typo?.dates.archived).toEqual({ date: null, day: null, source: "unreadable" });
    expect(typo?.archivedDate).toBeNull();
    expect(timelines.find((timeline) => timeline.changeName === "sound-change")?.dates.proposed.date)
      .toBe("2026-03-01T10:00:00.000Z");
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
