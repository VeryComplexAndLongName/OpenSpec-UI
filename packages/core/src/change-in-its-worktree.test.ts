import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChangeInItsWorktree } from "./change-in-its-worktree.js";
import type { GitWrapper } from "./git.js";

// every-varying-check-has-a-budget: the git wrapper and `openspec new
// change` are fakes, so nothing is spawned.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function repository(): Promise<string> {
  const parent = await mkdtemp(path.join(os.tmpdir(), "openspec-new-change-"));
  roots.push(parent);
  return path.join(parent, "shop");
}

function fakeGit(remote: string | undefined) {
  const calls: string[] = [];
  const added: Array<{ path: string; branch: string; base: string }> = [];
  const git = {
    remoteUrl: async () => remote,
    fetch: async (name: string) => { calls.push(`fetch ${name}`); },
    pathExistsInRef: async () => false,
    worktreeList: async () => [],
    branchExists: async () => false,
    worktreeAdd: async (options: { path: string; branch: string; base: string }) => { added.push(options); },
  } as unknown as GitWrapper;
  return { git, calls, added };
}

// agents-are-told-how-work-is-done-here 1.3, ADR 0043.
describe("createChangeInItsWorktree", () => {
  it("cuts the change's own directory from origin/main after a fetch, and makes the change there", async () => {
    const root = await repository();
    const { git, calls, added } = fakeGit("https://example.test/shop.git");
    const created: Array<{ name: string; cwd: string }> = [];

    const made = await createChangeInItsWorktree({
      repositoryRoot: root,
      changeName: "add-cart",
      git,
      rootSources: { env: {}, homeDirectory: path.join(path.dirname(root), "no-home") },
      create: async (name, options) => { created.push({ name, cwd: options.cwd ?? "" }); return {}; },
    });

    expect(calls).toEqual(["fetch origin"]);
    expect(added).toEqual([{ path: path.join(path.dirname(root), ".worktrees", "shop", "add-cart"), branch: "add-cart", base: "origin/main" }]);
    expect(created).toEqual([{ name: "add-cart", cwd: added[0]!.path }]);
    expect(made).toEqual({ directory: added[0]!.path, branch: "add-cart" });
  });

  it("makes the change where it always was in a repository with no remote", async () => {
    const root = await repository();
    const { git, added } = fakeGit(undefined);
    const created: string[] = [];

    const made = await createChangeInItsWorktree({
      repositoryRoot: root,
      changeName: "add-cart",
      git,
      create: async (_name, options) => { created.push(options.cwd ?? ""); return {}; },
    });

    expect(added).toEqual([]);
    expect(created).toEqual([root]);
    expect(made).toEqual({ directory: root });
  });
});
