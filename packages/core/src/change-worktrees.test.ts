import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultWorktreePath, listChangeWorktrees, planChangeWorktree } from "./change-worktrees.js";
import { parseWorktreePorcelain, type GitWorktree, type GitWrapper } from "./git.js";

// every-varying-check-has-a-budget: no git process is spawned here — the
// wrapper is a fake — so each test is a few small file writes. Measured
// 2026-09-11 under 50ms for the slowest.
vi.setConfig({ testTimeout: 15_000 });

/** A home directory holding no settings file, so the default answers.
 * Pointing at a real but empty place rather than at the tester's own
 * home, whose settings would decide the result of somebody else's run. */
const NO_SETTINGS = path.join(os.tmpdir(), "openspec-ui-no-settings-here");

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-worktrees-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** A wrapper that answers the three questions a plan asks and fails the
 * test on anything that would change the repository. */
function fakeGit(options: {
  worktrees?: GitWorktree[];
  inRef?: (ref: string, pathInRepo: string) => boolean;
  branchExists?: boolean;
} = {}): GitWrapper & { added: unknown[]; removed: string[] } {
  const added: unknown[] = [];
  const removed: string[] = [];
  return {
    added,
    removed,
    status: vi.fn(),
    diff: vi.fn(),
    commit: vi.fn(),
    push: vi.fn(),
    currentBranch: vi.fn(),
    branchExists: async () => options.branchExists ?? false,
    worktreeList: async () => options.worktrees ?? [{ path: "/repo" }],
    worktreeAdd: async (plan: { path: string; branch: string; base: string }) => {
      added.push(plan);
    },
    worktreeRemove: async (target: string) => {
      removed.push(target);
    },
    pathExistsInRef: async (ref: string, pathInRepo: string) =>
      (options.inRef ?? (() => true))(ref, pathInRepo),
  } as unknown as GitWrapper & { added: unknown[]; removed: string[] };
}

describe("parseWorktreePorcelain", () => {
  it("reads a path containing a space", () => {
    // The human format is column-aligned and unquoted, so this path
    // cannot be recovered from it. That is the whole reason the porcelain
    // format is what gets parsed.
    const parsed = parseWorktreePorcelain(
      [
        "worktree /home/me/My Repo",
        "HEAD abc123",
        "branch refs/heads/main",
        "",
        "worktree /home/me/My Repo.worktrees/a-change",
        "HEAD def456",
        "branch refs/heads/a-change",
        "",
      ].join("\n"),
    );

    expect(parsed).toEqual([
      { path: "/home/me/My Repo", head: "abc123", branch: "main" },
      { path: "/home/me/My Repo.worktrees/a-change", head: "def456", branch: "a-change" },
    ]);
  });

  it("leaves a detached head with no branch", () => {
    const parsed = parseWorktreePorcelain(["worktree /repo/detached", "HEAD abc123", "detached", ""].join("\n"));

    expect(parsed).toEqual([{ path: "/repo/detached", head: "abc123" }]);
  });

  it("reads the last entry when the output does not end with a blank line", () => {
    const parsed = parseWorktreePorcelain("worktree /repo\nHEAD abc123\nbranch refs/heads/main");

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ path: "/repo", branch: "main" });
  });
});

describe("defaultWorktreePath", () => {
  it("goes under one root, named by its repository, and never inside the repository", async () => {
    // Nested inside its own main working tree it would put a complete
    // second copy of the repository under a directory every recursive
    // tool in the repository walks.
    // Resolved on both sides: on Windows the repository root gains a
    // drive letter, and comparing a resolved path to an unresolved one
    // would fail for a reason that has nothing to do with the rule.
    const repository = path.resolve(path.join(path.sep, "home", "me", "repo"));
    const target = await defaultWorktreePath(repository, "a-change", { env: {}, homeDirectory: NO_SETTINGS });

    // One root for every repository (ADR 0027), with the repository as a
    // segment inside it rather than a container beside it.
    expect(target).toBe(path.join(path.dirname(repository), ".worktrees", "repo", "a-change"));
    expect(target.startsWith(repository + path.sep)).toBe(false);
  });
});

describe("planChangeWorktree", () => {
  it("plans a branch and a directory named after the change", async () => {
    const root = await temporaryRoot();
    const git = fakeGit();

    const plan = await planChangeWorktree({ git, repositoryRoot: root, changeName: "a-change" });

    expect(plan).toMatchObject({
      ok: true,
      branch: "a-change",
      base: "main",
      path: defaultWorktreePath(root, "a-change"),
    });
    // Planning creates nothing.
    expect(git.added).toHaveLength(0);
  });

  it("refuses a change that is not in the base commit, saying to commit it", async () => {
    const root = await temporaryRoot();
    const git = fakeGit({ inRef: () => false });

    const plan = await planChangeWorktree({ git, repositoryRoot: root, changeName: "a-change" });

    expect(plan).toMatchObject({ ok: false });
    if (!plan.ok) {
      expect(plan.refusal.reason).toContain("is not in main");
      expect(plan.refusal.remedy).toContain("commit openspec/changes/a-change");
    }
    expect(git.added).toHaveLength(0);
  });

  it("looks for the change under the base it was given", async () => {
    const root = await temporaryRoot();
    const seen: string[] = [];
    const git = fakeGit({
      inRef: (ref) => {
        seen.push(ref);
        return true;
      },
    });

    await planChangeWorktree({ git, repositoryRoot: root, changeName: "a-change", base: "release/1.x" });

    expect(seen).toEqual(["release/1.x"]);
  });

  it("refuses a branch that is already checked out somewhere", async () => {
    const root = await temporaryRoot();
    const git = fakeGit({
      worktrees: [{ path: "/repo" }, { path: "/repo.worktrees/a-change", branch: "a-change" }],
    });

    const plan = await planChangeWorktree({ git, repositoryRoot: root, changeName: "a-change" });

    expect(plan).toMatchObject({ ok: false });
    if (!plan.ok) expect(plan.refusal.reason).toContain("/repo.worktrees/a-change");
    expect(git.added).toHaveLength(0);
  });

  it("refuses a directory that already exists", async () => {
    const root = await temporaryRoot();
    const target = path.join(root, "taken");
    await mkdir(target, { recursive: true });
    const git = fakeGit();

    const plan = await planChangeWorktree({ git, repositoryRoot: root, changeName: "a-change", path: target });

    expect(plan).toMatchObject({ ok: false });
    if (!plan.ok) expect(plan.refusal.reason).toContain("already exists");
    expect(git.added).toHaveLength(0);
  });

  it("refuses a name that is not a change name at all", async () => {
    const root = await temporaryRoot();
    const git = fakeGit();

    const plan = await planChangeWorktree({ git, repositoryRoot: root, changeName: "../../etc" });

    expect(plan).toMatchObject({ ok: false });
    if (!plan.ok) expect(plan.refusal.reason).toContain("not a valid change name");
  });
});

describe("listChangeWorktrees", () => {
  async function repositoryWith(activeChanges: string[]): Promise<string> {
    const root = await temporaryRoot();
    for (const changeName of activeChanges) {
      const changeDir = path.join(root, "openspec", "changes", changeName);
      await mkdir(changeDir, { recursive: true });
      await writeFile(path.join(changeDir, "proposal.md"), "# A change\n\n## Why\n\nBecause.\n", "utf8");
      await writeFile(path.join(changeDir, "tasks.md"), "- [ ] 1.1 Do it\n", "utf8");
    }
    return root;
  }

  it("says which change each directory belongs to, and which are still active", async () => {
    const root = await repositoryWith(["still-going"]);
    const git = fakeGit({
      worktrees: [
        { path: root, branch: "main" },
        { path: path.join(root, "..", "w", "still-going"), branch: "still-going" },
        { path: path.join(root, "..", "w", "long-archived"), branch: "long-archived" },
      ],
    });

    const listed = await listChangeWorktrees({ git, repositoryRoot: root });

    expect(listed[0]).toMatchObject({ isMain: true });
    expect(listed[0]?.changeName).toBeUndefined();
    expect(listed[1]).toMatchObject({ changeName: "still-going", changeIsActive: true, isMain: false });
    // A directory that outlived the change it was made for is the litter
    // this listing exists to surface.
    expect(listed[2]).toMatchObject({ changeName: "long-archived", changeIsActive: false });
  });

  it("leaves a branch that is not a change name unattributed", async () => {
    const root = await repositoryWith([]);
    const git = fakeGit({
      worktrees: [{ path: root, branch: "main" }, { path: "/elsewhere", branch: "Some/Feature" }],
    });

    const listed = await listChangeWorktrees({ git, repositoryRoot: root });

    expect(listed[1]?.changeName).toBeUndefined();
  });
});

describe("planChangeWorktree — a branch left behind by a removal", () => {
  it("refuses a change whose branch exists with no directory, and says what to do", async () => {
    const root = await temporaryRoot();
    // Removing a working directory leaves its branch, so the second
    // attempt at one change meets exactly this.
    const git = fakeGit({ branchExists: true });

    const plan = await planChangeWorktree({
      git,
      repositoryRoot: root,
      changeName: "a-change",
      rootSources: { env: {}, homeDirectory: NO_SETTINGS },
    });

    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.refusal.reason).toContain("no working directory on it");
      // Git's own message is true and says nothing about what to do next.
      expect(plan.refusal.remedy).toContain("git branch -D a-change");
    }
  });
});
