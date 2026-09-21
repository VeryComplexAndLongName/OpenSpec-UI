import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rebaseBehindBranches } from "./branch-rebase.js";
import { describeWorkspaceSweep, sweepWorkspace } from "./workspace-sweep.js";
import { createGitWrapper } from "./git.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";
import type { SurveyedDirectory, WorktreeSurvey } from "./worktree-survey-facts.js";

// ADR 0034, a-behind-branch-is-rebased-for-you. Real git against a bare
// remote, because what is asserted is what reaches the server: a rebased
// branch arrives, a conflicted one does not move, and a lease that is
// refused leaves the branch exactly where it was.
//
// every-varying-check-has-a-budget: real git processes, pushes through a
// local remote included, whose time varies with the machine and its load.
vi.setConfig({ testTimeout: 90_000 });

const run = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }).catch(() => undefined)));
});

async function git(cwd: string, args: string[]): Promise<string> {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.com",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.com",
  };
  const { stdout } = await run("git", [...(await gitIsolationArgs()), ...args], { cwd, env });
  return stdout.trim();
}

async function write(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

interface Fixture { root: string; work: string; worktree: string; remote: string }

/** A bare remote, a main checkout, and a change `demo` on its own pushed
 * branch in its own working directory - which `main` has then moved past.
 * `touchOnMain` decides whether the default branch's new commit touches
 * the same file the change does, which is what makes a conflict. */
async function behindBranch(options: { conflict?: boolean } = {}): Promise<Fixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-rebase-"));
  roots.push(root);
  const remote = path.join(root, "remote.git");
  const work = path.join(root, "work");
  await git(root, ["init", "-q", "--bare", "-b", "main", remote]);
  await mkdir(work);
  await git(work, ["init", "-q", "-b", "main"]);
  // A rebase makes commits, through the product's own git and not this
  // helper, so the identity lives in the repository: a runner has no
  // global one to fall back on, and this machine does.
  await git(work, ["config", "user.name", "Fixture"]);
  await git(work, ["config", "user.email", "fixture@example.com"]);
  await git(work, ["remote", "add", "origin", remote]);
  await write(path.join(work, "shared.txt"), "one\n");
  await git(work, ["add", "."]);
  await git(work, ["commit", "-q", "-m", "first"]);
  await git(work, ["push", "-q", "-u", "origin", "main"]);

  const worktree = path.join(root, "wt-demo");
  await git(work, ["worktree", "add", "-q", "-b", "demo", worktree]);
  await write(path.join(worktree, "openspec", "changes", "demo", "proposal.md"), "## Why\n\nBecause.\n");
  if (options.conflict) await write(path.join(worktree, "shared.txt"), "the change's line\n");
  await git(worktree, ["add", "."]);
  await git(worktree, ["commit", "-q", "-m", "the change"]);
  await git(worktree, ["push", "-q", "-u", "origin", "demo"]);

  // Another pull request lands on main.
  await write(path.join(work, options.conflict ? "shared.txt" : "other.txt"), "main's line\n");
  await git(work, ["add", "."]);
  await git(work, ["commit", "-q", "-m", "another change landed"]);
  await git(work, ["push", "-q", "origin", "main"]);
  await git(worktree, ["fetch", "-q", "origin"]);

  return { root, work, worktree, remote };
}

function surveyOf(fixture: Fixture, partial: Partial<Extract<SurveyedDirectory, { readable: true }>> = {}): WorktreeSurvey {
  const base = { labelDeclared: false, isThis: false, runs: [], readable: true as const, authorDiffers: false };
  return {
    directories: [
      { ...base, path: fixture.work, label: "work", isMain: true, branch: "main", changes: [] },
      {
        ...base,
        path: fixture.worktree,
        label: "wt-demo",
        isMain: false,
        branch: "demo",
        changes: [{ changeName: "demo", tasksDone: 0, tasksTotal: 0, blockers: [], alsoIn: [] }],
        ...partial,
      },
    ],
    runsElsewhere: [],
  };
}

async function sweep(fixture: Fixture, survey = surveyOf(fixture)) {
  const upstreams = await createGitWrapper({ cwd: fixture.work }).branchUpstreams();
  return rebaseBehindBranches(survey, {
    gitIn: (directory) => createGitWrapper({ cwd: directory }),
    isClean: async (directory) => (await createGitWrapper({ cwd: directory }).status()).isClean,
    upstreams,
  });
}

describe("rebasing a change's branch that fell behind", () => {
  it("rebases it onto the default branch and pushes it to the server", async () => {
    const fixture = await behindBranch();

    const result = await sweep(fixture);

    expect({ conflicted: result.conflicted, failed: result.failed }).toEqual({ conflicted: [], failed: [] });
    expect(result.rebased.map((one) => one.branch)).toEqual(["demo"]);
    expect(result.rebased[0]?.behind).toBe(1);
    // The server's copy of the branch now carries main's new commit.
    const onServer = await git(fixture.remote, ["log", "--format=%s", "demo"]);
    expect(onServer.split("\n")).toEqual(["the change", "another change landed", "first"]);
  });

  it("never resolves a conflict: aborts, names the file, and leaves the branch as it was", async () => {
    const fixture = await behindBranch({ conflict: true });
    const before = await git(fixture.worktree, ["rev-parse", "HEAD"]);

    const result = await sweep(fixture);

    expect(result.rebased).toEqual([]);
    expect(result.conflicted.map((one) => one.conflicts)).toEqual([["shared.txt"]]);
    expect(await git(fixture.worktree, ["rev-parse", "HEAD"])).toBe(before);
    // Not left half-way through a rebase.
    expect(await git(fixture.worktree, ["status", "--porcelain"])).toBe("");
  });

  it("puts the branch back where it was when the lease refuses the push", async () => {
    const fixture = await behindBranch();
    const before = await git(fixture.worktree, ["rev-parse", "HEAD"]);
    const upstreams = await createGitWrapper({ cwd: fixture.work }).branchUpstreams();

    const result = await rebaseBehindBranches(surveyOf(fixture), {
      gitIn: (directory) => {
        const real = createGitWrapper({ cwd: directory });
        // Somebody else pushed first: the lease refuses.
        return { ...real, pushWithLease: async () => { throw new Error("stale info"); } };
      },
      isClean: async () => true,
      upstreams,
    });

    expect({ conflicted: result.conflicted, failed: result.failed.map((one) => one.reason) })
      .toEqual({ conflicted: [], failed: ["stale info"] });
    expect(await git(fixture.worktree, ["rev-parse", "HEAD"])).toBe(before);
  });

  it("leaves a branch holding uncommitted work alone", async () => {
    const fixture = await behindBranch();
    await write(path.join(fixture.worktree, "wip.txt"), "not yet\n");

    const result = await sweep(fixture);

    expect(result.rebased).toEqual([]);
    expect(result.skipped.find((one) => one.branch === "demo")?.reason).toBe("uncommitted-work");
  });

  it("leaves a branch with commits the server lacks alone: a push would carry new work", async () => {
    const fixture = await behindBranch();
    await write(path.join(fixture.worktree, "more.txt"), "unpushed\n");
    await git(fixture.worktree, ["add", "."]);
    await git(fixture.worktree, ["commit", "-q", "-m", "not pushed"]);

    const result = await sweep(fixture);

    expect(result.skipped.find((one) => one.branch === "demo")?.reason).toBe("ahead-of-its-upstream");
  });

  it("leaves a branch this product did not name alone", async () => {
    const fixture = await behindBranch();

    const result = await sweep(fixture, surveyOf(fixture, { changes: [] }));

    expect(result.skipped.find((one) => one.branch === "demo")?.reason).toBe("not-a-change-branch");
  });

  it("leaves a directory a run is working in alone", async () => {
    const fixture = await behindBranch();
    const running = surveyOf(fixture, { runs: [{ gone: false } as never] });

    const result = await sweep(fixture, running);

    expect(result.skipped.find((one) => one.branch === "demo")?.reason).toBe("a-run-is-recorded");
  });
});

describe("a workspace with nothing to act on", () => {
  it("asks nothing of a repository with no remote, and says nothing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-rebase-alone-"));
    roots.push(root);
    await git(root, ["init", "-q", "-b", "main"]);
    await write(path.join(root, "a.txt"), "one\n");
    await git(root, ["add", "."]);
    await git(root, ["commit", "-q", "-m", "first"]);

    const swept = await sweepWorkspace(root);

    // Not "the repository could not be fetched", on every interval.
    expect(describeWorkspaceSweep(swept)).toEqual([]);
    expect(swept.branches).toBeUndefined();
  });

  it("does the whole pass where there is a behind change branch", async () => {
    const fixture = await behindBranch();

    const swept = await sweepWorkspace(fixture.work);

    expect({ lines: describeWorkspaceSweep(swept), rebased: swept.branches?.rebased.map((one) => one.branch) })
      .toMatchObject({ rebased: ["demo"] });
    expect(describeWorkspaceSweep(swept).join(" ")).toContain("rebased demo onto origin/main");
  });
});

describe("a rebase that stops without a conflict", () => {
  it("is a failure with git's reason, not a conflict with no files", async () => {
    const fixture = await behindBranch();
    const upstreams = await createGitWrapper({ cwd: fixture.work }).branchUpstreams();

    const result = await rebaseBehindBranches(surveyOf(fixture), {
      gitIn: (directory) => ({
        ...createGitWrapper({ cwd: directory }),
        rebaseOnto: async () => ({ ok: false as const, conflicts: [], reason: "Author identity unknown" }),
      }),
      isClean: async () => true,
      upstreams,
    });

    expect(result.conflicted).toEqual([]);
    expect(result.failed.map((one) => one.reason)).toEqual(["the rebase stopped: Author identity unknown"]);
  });
});

