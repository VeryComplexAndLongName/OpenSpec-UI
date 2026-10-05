import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commitTaskList } from "./own-worktree-tasks.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";

// a-card-works-its-own-tasks 2.4. Real git against a bare remote, because
// what is asserted is what reaches the server: one commit holding the task
// list alone, on the change's branch.
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

/** A bare remote, a main checkout, and the change `demo` in its own
 * worktree with a `tasks.md`. `pushed` decides whether the change's branch
 * is already on the server. */
async function changeInItsWorktree(options: { pushed: boolean }): Promise<{ work: string; worktree: string; remote: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-own-commit-"));
  roots.push(root);
  const remote = path.join(root, "remote.git");
  const work = path.join(root, "work");
  await git(root, ["init", "-q", "--bare", "-b", "main", remote]);
  await mkdir(work);
  await git(work, ["init", "-q", "-b", "main"]);
  // The product's own git makes the commit, so the identity lives in the
  // repository: a runner has no global one to fall back on.
  await git(work, ["config", "user.name", "Fixture"]);
  await git(work, ["config", "user.email", "fixture@example.com"]);
  await git(work, ["remote", "add", "origin", remote]);
  await write(path.join(work, "README.md"), "repo\n");
  await git(work, ["add", "."]);
  await git(work, ["commit", "-q", "-m", "first"]);
  await git(work, ["push", "-q", "-u", "origin", "main"]);

  const worktree = path.join(root, "wt-demo");
  await git(work, ["worktree", "add", "-q", "-b", "demo", worktree]);
  await write(path.join(worktree, "openspec", "changes", "demo", "tasks.md"), "- [ ] 1.1 **Human-only**: look.\n");
  await write(path.join(worktree, "src.txt"), "code\n");
  await git(worktree, ["add", "."]);
  await git(worktree, ["commit", "-q", "-m", "the change"]);
  if (options.pushed) await git(worktree, ["push", "-q", "-u", "origin", "demo"]);
  return { work, worktree, remote };
}

describe("commitTaskList", () => {
  it("commits tasks.md alone, with other files dirty, and pushes the change's branch", async () => {
    const { work, worktree, remote } = await changeInItsWorktree({ pushed: true });
    await write(path.join(worktree, "openspec", "changes", "demo", "tasks.md"), "- [x] 1.1 **Human-only**: look.\n  Closed by Fixture on 2026-10-05: seen.\n");
    await write(path.join(worktree, "src.txt"), "code, still being written\n");
    await git(worktree, ["add", "src.txt"]);

    const result = await commitTaskList({ repositoryRoot: work, changeName: "demo" });

    expect(result).toMatchObject({ ok: true, branch: "demo", pushedTo: "origin/demo", message: "tasks(demo): ticked 1.1" });
    const files = await git(remote, ["show", "--name-only", "--format=", "demo"]);
    expect(files.split(/\r?\n/)).toEqual(["openspec/changes/demo/tasks.md"]);
    // What else was staged stays staged, and stays uncommitted.
    expect(await git(worktree, ["diff", "--cached", "--name-only"])).toBe("src.txt");
  });

  it("pushes a branch that has no upstream with one", async () => {
    const { work, worktree, remote } = await changeInItsWorktree({ pushed: false });
    await write(path.join(worktree, "openspec", "changes", "demo", "tasks.md"), "- [x] 1.1 **Human-only**: look.\n  Closed by Fixture on 2026-10-05: seen.\n");

    const result = await commitTaskList({ repositoryRoot: work, changeName: "demo" });

    expect(result).toMatchObject({ ok: true, pushedTo: "origin/demo" });
    expect(await git(remote, ["rev-parse", "demo"])).toBe(await git(worktree, ["rev-parse", "HEAD"]));
    expect(await git(worktree, ["rev-parse", "--abbrev-ref", "demo@{upstream}"])).toBe("origin/demo");
  });

  it("says there is nothing to commit, and commits nothing", async () => {
    const { work, worktree } = await changeInItsWorktree({ pushed: true });
    const before = await git(worktree, ["rev-parse", "HEAD"]);

    expect(await commitTaskList({ repositoryRoot: work, changeName: "demo" })).toMatchObject({ ok: false, kind: "nothing-to-commit" });
    expect(await git(worktree, ["rev-parse", "HEAD"])).toBe(before);
  });

  it("refuses a change with no worktree of its own", async () => {
    const { work } = await changeInItsWorktree({ pushed: true });
    expect(await commitTaskList({ repositoryRoot: work, changeName: "other" })).toMatchObject({ ok: false, kind: "no-worktree" });
  });

  it("keeps the commit and reports git's words where the push is refused", async () => {
    const { work, worktree } = await changeInItsWorktree({ pushed: true });
    await git(worktree, ["remote", "set-url", "origin", path.join(path.dirname(work), "no-such-remote.git")]);
    await write(path.join(worktree, "openspec", "changes", "demo", "tasks.md"), "- [x] 1.1 **Human-only**: look.\n  Closed by Fixture on 2026-10-05: seen.\n");

    const result = await commitTaskList({ repositoryRoot: work, changeName: "demo" });

    expect(result).toMatchObject({ ok: false, kind: "push-rejected" });
    expect(result.ok ? undefined : (result as { commit?: string }).commit).toBe(await git(worktree, ["rev-parse", "HEAD"]));
  });
});
