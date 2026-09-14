import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGitWrapper } from "./git.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";

// every-varying-check-has-a-budget: real git processes against temporary
// repositories with a bare remote, whose time varies with the machine and
// its load, so each test gets a generous ceiling.
vi.setConfig({ testTimeout: 60_000 });

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

async function writeTasks(root: string, changeName: string, text: string): Promise<void> {
  const directory = path.join(root, "openspec", "changes", changeName);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "tasks.md"), text, "utf8");
}

/** A repository whose `main` has one change and whose branch `beta`, pushed
 * and not checked out, has a second. */
async function repositoryWithRemote(): Promise<{ work: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-git-refs-"));
  roots.push(root);
  const remote = path.join(root, "remote.git");
  const work = path.join(root, "work");
  await mkdir(work);
  await git(root, ["init", "-q", "--bare", "-b", "main", remote]);
  await git(work, ["init", "-q", "-b", "main"]);
  await writeTasks(work, "alpha", "- [ ] 1.1 One\n");
  await git(work, ["add", "."]);
  await git(work, ["commit", "-q", "-m", "alpha"]);
  await git(work, ["remote", "add", "origin", remote]);
  await git(work, ["push", "-q", "origin", "main"]);
  await git(work, ["checkout", "-q", "-b", "beta"]);
  await writeTasks(work, "beta", "- [x] 1.1 One\n- [ ] 1.2 Two\n");
  await git(work, ["add", "."]);
  await git(work, ["commit", "-q", "-m", "beta"]);
  await git(work, ["push", "-q", "origin", "beta"]);
  await git(work, ["checkout", "-q", "main"]);
  return { work };
}

describe("GitWrapper — reading refs (a-change-says-where-it-stands 1.2)", () => {
  it("reads a directory and a file from a branch that is not checked out", async () => {
    const { work } = await repositoryWithRemote();
    const wrapper = createGitWrapper({ cwd: work });

    expect(await wrapper.listTreeNames("beta", "openspec/changes")).toEqual(["alpha", "beta"]);
    expect(await wrapper.showFile("origin/beta", "openspec/changes/beta/tasks.md")).toContain("1.2 Two");
  });

  it("reads a missing path as undefined or empty, not as an error, and a missing ref as absent", async () => {
    const { work } = await repositoryWithRemote();
    const wrapper = createGitWrapper({ cwd: work });

    expect(await wrapper.showFile("main", "openspec/changes/beta/tasks.md")).toBeUndefined();
    expect(await wrapper.listTreeNames("main", "openspec/changes/archive")).toEqual([]);
    expect(await wrapper.refExists("origin/beta")).toBe(true);
    expect(await wrapper.refExists("no-such-branch")).toBe(false);
    await expect(wrapper.listTreeNames("no-such-branch", "openspec/changes")).rejects.toBeInstanceOf(Error);
  });

  it("moves lastFetchedAt with a fetch, lists refs in one call, and finds the merge base", async () => {
    const { work } = await repositoryWithRemote();
    const wrapper = createGitWrapper({ cwd: work });

    expect(await wrapper.lastFetchedAt()).toBeUndefined();
    await wrapper.fetch("origin");
    const fetched = await wrapper.lastFetchedAt();

    expect(fetched).toBeInstanceOf(Date);
    const mainCommit = await git(work, ["rev-parse", "main"]);
    expect((await wrapper.listRefs(["refs/heads", "refs/remotes/origin"])).map((ref) => ref.name)).toEqual(
      expect.arrayContaining(["refs/heads/main", "refs/heads/beta", "refs/remotes/origin/main", "refs/remotes/origin/beta"]),
    );
    expect(await wrapper.listRefs(["refs/heads/main"])).toEqual([{ name: "refs/heads/main", commit: mainCommit }]);
    expect(await wrapper.resolveCommit("HEAD")).toBe(mainCommit);
    expect(await wrapper.resolveCommit("no-such-branch")).toBeUndefined();
    expect(await wrapper.mergeBase("main", "beta")).toBe(await git(work, ["rev-parse", "main"]));
  });
});
