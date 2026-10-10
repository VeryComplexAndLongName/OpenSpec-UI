import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commitChange } from "./change-commit.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";

// a-change-is-committed-where-it-is-made. Real git against a bare remote,
// because what is asserted is what reaches the server: the change's branch
// with the change on it.
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
  const { stdout } = await run("git", [...(await gitIsolationArgs()), ...args], { cwd });
  return stdout.trim();
}

async function write(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

/** A bare remote, a main checkout pushed to it, and a change `demo` whose
 * worktree holds its files uncommitted, on a branch never pushed: what an
 * agent left behind when it was told where to commit and never when. */
async function uncommittedChange(): Promise<{ work: string; worktree: string; remote: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-commit-change-"));
  roots.push(root);
  const remote = path.join(root, "remote.git");
  const work = path.join(root, "work");
  await git(root, ["init", "-q", "--bare", "-b", "main", remote]);
  await mkdir(work);
  await git(work, ["init", "-q", "-b", "main"]);
  // The product commits through its own git, so the identity, and no
  // signing, live in the repository.
  await git(work, ["config", "user.name", "Fixture"]);
  await git(work, ["config", "user.email", "fixture@example.com"]);
  await git(work, ["config", "commit.gpgsign", "false"]);
  await git(work, ["remote", "add", "origin", remote]);
  await write(path.join(work, "openspec", "config.yaml"), "schema: spec-driven\n");
  await git(work, ["add", "."]);
  await git(work, ["commit", "-q", "-m", "first"]);
  await git(work, ["push", "-q", "-u", "origin", "main"]);

  const worktree = path.join(root, "wt-demo");
  await git(work, ["worktree", "add", "-q", "-b", "demo", worktree]);
  await write(path.join(worktree, "openspec", "changes", "demo", "proposal.md"), "## Why\n\nBecause.\n");
  await write(path.join(worktree, "openspec", "changes", "demo", "tasks.md"), "## 1. Do\n\n- [ ] 1.1 It\n");
  return { work, worktree, remote };
}

describe("commitChange", () => {
  it("commits what the change's worktree holds on its branch, and pushes the branch with an upstream", async () => {
    const { work, worktree, remote } = await uncommittedChange();

    const result = await commitChange({ repositoryRoot: work, changeName: "demo" });

    expect(result).toMatchObject({ ok: true, pushedTo: "origin/demo" });
    expect(await git(worktree, ["status", "--porcelain"])).toBe("");
    expect(await git(remote, ["ls-tree", "-r", "--name-only", "demo"])).toContain("openspec/changes/demo/proposal.md");
    expect(await git(worktree, ["rev-parse", "--abbrev-ref", "demo@{upstream}"])).toBe("origin/demo");
    expect(await git(worktree, ["log", "-1", "--format=%s"])).toBe("demo: commit what its worktree holds");
    // Nothing of the change reached the default branch.
    expect(await git(remote, ["ls-tree", "-r", "--name-only", "main"])).not.toContain("openspec/changes/demo/proposal.md");
  });

  it("refuses a change with no worktree of its own, committing nothing in the checkout", async () => {
    const { work } = await uncommittedChange();
    await write(path.join(work, "openspec", "changes", "here", "proposal.md"), "## Why\n");

    const result = await commitChange({ repositoryRoot: work, changeName: "here" });

    expect(result).toMatchObject({ ok: false, kind: "no-worktree" });
    expect(await git(work, ["status", "--porcelain"])).not.toBe("");
  });
});
