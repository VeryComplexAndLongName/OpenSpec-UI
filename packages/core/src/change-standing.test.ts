import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeChangeState } from "./change-state-word.js";
import { describeStandingSources, readChangeStandings } from "./change-standing.js";
import type { PullRequestsByBranch } from "./gh-pr-gateway.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";
import { surveyWorktrees } from "./worktree-survey.js";

// every-varying-check-has-a-budget: real git processes against a temporary
// repository, whose time varies with the machine and its load, so each test
// gets a generous ceiling. `gh` is never run, and nothing is pushed: the
// remote's refs are written with `update-ref`, since a local push starts a
// shell that Windows' msys runtime can fail to start under load.
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

async function writeTasks(root: string, changeName: string, ticks: boolean[]): Promise<void> {
  const directory = path.join(root, "openspec", "changes", changeName);
  await mkdir(directory, { recursive: true });
  const lines = ticks.map((done, index) => `- [${done ? "x" : " "}] 1.${index + 1} Task`);
  await writeFile(path.join(directory, "tasks.md"), `${lines.join("\n")}\n`, "utf8");
}

/** Makes `refs/remotes/origin/<branch>` point where the local branch does,
 * as a push followed by a fetch would. */
async function publish(work: string, branch: string): Promise<void> {
  await git(work, ["update-ref", `refs/remotes/origin/${branch}`, await git(work, ["rev-parse", branch])]);
}

const NO_PULL_REQUESTS: PullRequestsByBranch = { available: true, byBranch: new Map() };

/** This checkout on branch `work`, cut from `main` when it had `alpha`,
 * `gamma` and `delta`. Since then `main` archived `alpha` and deleted
 * `gamma`; branch `delta` ticked both of its tasks; and `epsilon` was made
 * here only. The remote is named but not there, so a fetch fails. */
async function repository(): Promise<{ work: string; worktreeRoot: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-standing-"));
  roots.push(root);
  const work = path.join(root, "work");
  const worktreeRoot = path.join(root, "wt-root");
  await mkdir(work);
  await git(work, ["init", "-q", "-b", "main"]);
  await git(work, ["remote", "add", "origin", path.join(root, "no-such-remote.git")]);
  await writeTasks(work, "alpha", [false, false]);
  await writeTasks(work, "gamma", [false]);
  await writeTasks(work, "delta", [false, false]);
  await git(work, ["add", "."]);
  await git(work, ["commit", "-q", "-m", "three changes"]);
  await git(work, ["branch", "work"]);

  await mkdir(path.join(work, "openspec", "changes", "archive"), { recursive: true });
  await rename(path.join(work, "openspec", "changes", "alpha"), path.join(work, "openspec", "changes", "archive", "2026-09-14-alpha"));
  await rm(path.join(work, "openspec", "changes", "gamma"), { recursive: true, force: true });
  await git(work, ["add", "-A"]);
  await git(work, ["commit", "-q", "-m", "archive alpha, delete gamma"]);
  await publish(work, "main");

  await git(work, ["checkout", "-q", "-b", "delta", "work"]);
  await writeTasks(work, "delta", [true, true]);
  await git(work, ["commit", "-q", "-am", "tick delta"]);
  await publish(work, "delta");
  await git(work, ["checkout", "-q", "work"]);
  await writeTasks(work, "epsilon", [false]);
  return { work, worktreeRoot };
}

function options(worktreeRoot: string, overrides: Parameters<typeof readChangeStandings>[1] = {}) {
  return {
    survey: (cwd: string) => surveyWorktrees({ workspaceRoot: cwd, rootSources: { env: { OPENSPEC_UI_WORKTREE_ROOT: worktreeRoot } } }),
    listPullRequests: async () => NO_PULL_REQUESTS,
    ...overrides,
  };
}

describe("readChangeStandings (a-change-says-where-it-stands 3.5)", () => {
  it("reads each change's standing from main, its branch and this checkout, and says which main it read", async () => {
    const { work, worktreeRoot } = await repository();

    const reading = await readChangeStandings(work, options(worktreeRoot));
    const byName = new Map(reading.standings.map((standing) => [standing.changeName, standing]));
    const wordOf = (name: string) => describeChangeState({ standing: byName.get(name)! }).word;

    expect(reading.sources.mainRef).toBe("origin/main");
    expect(byName.get("alpha")?.main).toEqual({ kind: "archived", archiveName: "2026-09-14-alpha" });
    expect(wordOf("alpha")).toBe("Archived on main");
    expect(byName.get("gamma")?.main).toEqual({ kind: "deleted" });
    expect(wordOf("gamma")).toBe("Deleted on main");
    expect(byName.get("delta")?.branch).toEqual({ name: "delta", local: true, remote: true, counts: { done: 2, total: 2 } });
    // Further along names the other copy and both counts.
    expect(wordOf("delta")).toBe("Further along on branch delta");
    expect(describeChangeState({ standing: byName.get("delta")! }).lines)
      .toContainEqual({ text: "2 of 2 done on branch delta, 0 of 2 here", source: "the copy on branch delta" });
    // A change the merge base never had is absent from main, not deleted.
    expect(byName.get("epsilon")?.main).toEqual({ kind: "absent" });
    expect(describeChangeState({ standing: byName.get("epsilon")! }).lines).toContainEqual({ text: "Only here", source: "every source read" });
  });

  it("says Merged in the pull request's number where gh reads the branch's request as merged", async () => {
    const { work, worktreeRoot } = await repository();

    const reading = await readChangeStandings(work, options(worktreeRoot, {
      listPullRequests: async () => ({ available: true, byBranch: new Map([["delta", { number: 5, state: "MERGED" as const }]]) }),
    }));
    const delta = reading.standings.find((standing) => standing.changeName === "delta")!;

    expect(describeChangeState({ standing: delta }).word).toBe("Merged in #5");
  });

  it("states a failed fetch and still answers from the refs it has", async () => {
    const { work, worktreeRoot } = await repository();

    const reading = await readChangeStandings(work, options(worktreeRoot, { fetch: "now" }));

    expect(reading.sources.fetch).toMatchObject({ attempted: true });
    expect(reading.sources.fetch.attempted && reading.sources.fetch.failed).toBeTruthy();
    expect(reading.standings.find((standing) => standing.changeName === "alpha")?.main).toEqual({ kind: "archived", archiveName: "2026-09-14-alpha" });
    expect(describeStandingSources(reading.sources)).toContain("failed");
  });

  it("leaves out every pull request fact where gh is unavailable, and says why", async () => {
    const { work, worktreeRoot } = await repository();

    const reading = await readChangeStandings(work, options(worktreeRoot, {
      listPullRequests: async () => ({ available: false, reason: "gh is not installed" }),
    }));

    expect(reading.sources.pullRequests).toEqual({ read: false, why: "gh is not installed" });
    expect(reading.standings.every((standing) => standing.pullRequest === undefined)).toBe(true);
    expect(describeStandingSources(reading.sources)).toContain("Pull requests were not read: gh is not installed.");
  });
});
