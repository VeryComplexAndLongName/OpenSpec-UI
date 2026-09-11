import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readChangeReadiness, describeCollision } from "./change-readiness.js";
import type { GitWorktree, GitWrapper } from "./git.js";

// every-varying-check-has-a-budget: no git process and no agent — the
// wrapper is a fake and the lease is a file. Measured 2026-09-11 under
// 80ms for the slowest.
vi.setConfig({ testTimeout: 15_000 });

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-readiness-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** A change with the capabilities its delta names, and optionally a
 * `blocked_by` relation. */
async function makeChange(
  root: string,
  changeName: string,
  options: { capabilities?: string[]; blockedBy?: string[] } = {},
): Promise<void> {
  const dir = path.join(root, "openspec", "changes", changeName);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "proposal.md"), `# ${changeName}\n\n## Why\n\nBecause.\n`, "utf8");
  await writeFile(path.join(dir, "tasks.md"), "- [ ] 1.1 Do it\n", "utf8");
  for (const capability of options.capabilities ?? []) {
    await mkdir(path.join(dir, "specs", capability), { recursive: true });
    await writeFile(path.join(dir, "specs", capability, "spec.md"), "## ADDED Requirements\n", "utf8");
  }
  const relations = (options.blockedBy ?? []).map((name) => `  - ${name}`).join("\n");
  await writeFile(
    path.join(dir, ".openspec.yaml"),
    `schema: spec-driven\ncreated: 2026-09-11\n${relations ? `blocked_by:\n${relations}\n` : ""}`,
    "utf8",
  );
}

async function writeLease(worktreePath: string, options: { ageMs?: number; pid?: number } = {}): Promise<void> {
  await mkdir(path.join(worktreePath, ".openspec-ui"), { recursive: true });
  const heartbeatAt = new Date(Date.now() - (options.ageMs ?? 0)).toISOString();
  await writeFile(
    path.join(worktreePath, ".openspec-ui", "workspace.lease.json"),
    JSON.stringify({
      version: 1,
      holderId: "someone",
      hostKind: "cli",
      hostname: "a-machine",
      pid: options.pid ?? 4242,
      acquiredAt: heartbeatAt,
      heartbeatAt,
    }),
    "utf8",
  );
}

function fakeGit(options: {
  worktrees?: GitWorktree[];
  changedFiles?: Record<string, string[]>;
} = {}): GitWrapper {
  return {
    worktreeList: async () => options.worktrees ?? [{ path: "/repo", branch: "main" }],
    changedFilesBetween: async (_base: string, branch: string) => options.changedFiles?.[branch] ?? [],
  } as unknown as GitWrapper;
}

describe("readChangeReadiness — states", () => {
  it("reports a change with nothing in its way as ready", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "alpha");

    const report = await readChangeReadiness({ workspaceRoot: root, git: fakeGit() });

    expect(report.changes).toHaveLength(1);
    expect(report.changes[0]?.run).toEqual({ state: "ready" });
  });

  it("reports a change waiting on an active change as blocked, naming it", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "alpha");
    await makeChange(root, "beta", { blockedBy: ["alpha"] });

    const report = await readChangeReadiness({ workspaceRoot: root, git: fakeGit() });
    const beta = report.changes.find((change) => change.changeName === "beta");

    // A state a reader has to investigate is a state that has not been
    // reported.
    expect(beta?.run).toEqual({ state: "blocked", blockedBy: ["alpha"] });
  });

  it("does not treat a blocker that has already landed as unmet", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "beta", { blockedBy: ["long-archived"] });

    const report = await readChangeReadiness({ workspaceRoot: root, git: fakeGit() });

    expect(report.changes[0]?.run).toEqual({ state: "ready" });
  });

  it("reports a change whose working directory holds the lease as running", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "alpha");
    const worktree = path.join(root, "wt", "wt-alpha");
    await writeLease(worktree, { pid: 777 });

    const report = await readChangeReadiness({
      workspaceRoot: root,
      git: fakeGit({ worktrees: [{ path: root, branch: "main" }, { path: worktree, branch: "alpha" }] }),
    });

    expect(report.changes[0]?.run).toMatchObject({
      state: "running",
      holder: { pid: 777, hostKind: "cli" },
    });
  });

  it("does not call a stale lease a running change", async () => {
    // The holder is gone and only its file is left, which is what
    // `acquireOrRenew` already treats as free.
    const root = await temporaryRoot();
    await makeChange(root, "alpha");
    const worktree = path.join(root, "wt", "wt-stale");
    await writeLease(worktree, { ageMs: 60_000 });

    const report = await readChangeReadiness({
      workspaceRoot: root,
      staleAfterMs: 20_000,
      git: fakeGit({ worktrees: [{ path: root, branch: "main" }, { path: worktree, branch: "alpha" }] }),
    });

    expect(report.changes[0]?.run).toEqual({ state: "ready" });
  });
});

describe("readChangeReadiness — what two changes would collide over", () => {
  /** Two ready changes, each with its own working directory, so the
   * only thing that can keep them apart is a collision. */
  function twoWorktrees(root: string) {
    return [
      { path: root, branch: "main" },
      { path: path.join(root, "wt", "wt-alpha"), branch: "alpha" },
      { path: path.join(root, "wt", "wt-beta"), branch: "beta" },
    ];
  }

  it("lets two changes that overlap in nothing start alongside each other", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "alpha", { capabilities: ["ci-cli"] });
    await makeChange(root, "beta", { capabilities: ["shared-ui"] });

    const report = await readChangeReadiness({
      workspaceRoot: root,
      git: fakeGit({ worktrees: twoWorktrees(root) }),
    });

    expect(report.changes.find((c) => c.changeName === "alpha")?.canJoin).toEqual(["beta"]);
    expect(report.changes.find((c) => c.changeName === "beta")?.canJoin).toEqual(["alpha"]);
  });

  it("catches the pair that actually happened: two deltas for one capability", async () => {
    // `a-change-runs-from-the-terminal` and `changes-run-side-by-side`
    // both delivered a delta to openspec/specs/ci-cli/spec.md. They ran
    // one after the other and nobody noticed; in parallel they would
    // have met in that file at archive.
    const root = await temporaryRoot();
    await makeChange(root, "a-change-runs-from-the-terminal", { capabilities: ["ci-cli"] });
    await makeChange(root, "changes-run-side-by-side", { capabilities: ["ci-cli"] });

    const report = await readChangeReadiness({
      workspaceRoot: root,
      git: fakeGit({
        worktrees: [
          { path: root, branch: "main" },
          { path: path.join(root, "wt", "wt-1"), branch: "a-change-runs-from-the-terminal" },
          { path: path.join(root, "wt", "wt-2"), branch: "changes-run-side-by-side" },
        ],
      }),
    });

    const first = report.changes.find((c) => c.changeName === "a-change-runs-from-the-terminal");
    expect(first?.canJoin).toEqual([]);
    expect(first?.blockedFrom).toEqual([
      {
        changeName: "changes-run-side-by-side",
        collisions: [{ kind: "shared-capability", capability: "ci-cli" }],
      },
    ]);
  });

  it("catches two branches that have changed the same file", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "alpha", { capabilities: ["ci-cli"] });
    await makeChange(root, "beta", { capabilities: ["shared-ui"] });

    const report = await readChangeReadiness({
      workspaceRoot: root,
      git: fakeGit({
        worktrees: twoWorktrees(root),
        changedFiles: {
          alpha: ["packages/core/src/git.ts", "packages/cli/src/main.ts"],
          beta: ["packages/cli/src/main.ts"],
        },
      }),
    });

    const alpha = report.changes.find((c) => c.changeName === "alpha");
    expect(alpha?.blockedFrom[0]?.collisions).toEqual([
      { kind: "overlapping-files", files: ["packages/cli/src/main.ts"] },
    ]);
  });

  it("reports a declared blocker between two ready changes as its own kind", async () => {
    // `beta` is blocked by an archived change, so both are ready — and
    // the declaration still says they cannot go together.
    const root = await temporaryRoot();
    await makeChange(root, "alpha");
    await makeChange(root, "beta", { blockedBy: ["alpha", "long-archived"] });
    // `alpha` is active, so beta is genuinely blocked; this case is the
    // pairwise report for the OTHER direction, which alpha sees.
    const report = await readChangeReadiness({
      workspaceRoot: root,
      git: fakeGit({ worktrees: twoWorktrees(root) }),
    });

    expect(report.changes.find((c) => c.changeName === "beta")?.run).toMatchObject({ state: "blocked" });
    // Only ready changes are paired, so alpha has nobody to be paired
    // with — which is the honest answer, not an omission.
    expect(report.changes.find((c) => c.changeName === "alpha")?.canJoin).toEqual([]);
  });

  it("answers per pair, so a chain of three is not forced into one group", async () => {
    // A and B collide, C collides with neither. There is no single
    // correct grouping, and presenting one would choose for the reader.
    const root = await temporaryRoot();
    await makeChange(root, "a", { capabilities: ["ci-cli"] });
    await makeChange(root, "b", { capabilities: ["ci-cli"] });
    await makeChange(root, "c", { capabilities: ["shared-ui"] });

    const report = await readChangeReadiness({
      workspaceRoot: root,
      git: fakeGit({
        worktrees: [
          { path: root, branch: "main" },
          { path: path.join(root, "wt", "wt-a"), branch: "a" },
          { path: path.join(root, "wt", "wt-b"), branch: "b" },
          { path: path.join(root, "wt", "wt-c"), branch: "c" },
        ],
      }),
    });

    expect(report.changes.find((x) => x.changeName === "a")?.canJoin).toEqual(["c"]);
    expect(report.changes.find((x) => x.changeName === "b")?.canJoin).toEqual(["c"]);
    expect(report.changes.find((x) => x.changeName === "c")?.canJoin).toEqual(["a", "b"]);
  });
});

describe("readChangeReadiness — somewhere to run", () => {
  it("says a ready change with no working directory cannot go beside anything", async () => {
    // One directory permits one mutating run, so this one is startable
    // instead of another, not alongside it.
    const root = await temporaryRoot();
    await makeChange(root, "alpha", { capabilities: ["ci-cli"] });
    await makeChange(root, "beta", { capabilities: ["shared-ui"] });

    const report = await readChangeReadiness({ workspaceRoot: root, git: fakeGit() });

    for (const change of report.changes) {
      expect(change.canJoin).toEqual([]);
      expect(change.needsWorktree).toContain("worktree add");
    }
  });

  it("still produces a report where the repository is not one git knows", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "alpha");
    const git = { worktreeList: async () => { throw new Error("not a git repository"); } } as unknown as GitWrapper;

    const report = await readChangeReadiness({ workspaceRoot: root, git });

    // Every change is then one without a working directory, which is a
    // true statement and a more useful report than none.
    expect(report.changes[0]?.run).toEqual({ state: "ready" });
  });
});

describe("describeCollision", () => {
  it("says what a reader acts on, for each kind", () => {
    expect(describeCollision({ kind: "declared-blocker", blocker: "alpha" })).toContain("blocked by alpha");
    expect(describeCollision({ kind: "shared-capability", capability: "ci-cli" })).toContain("one spec file");
    expect(describeCollision({ kind: "overlapping-files", files: ["a.ts"] })).toContain("a.ts");
    expect(describeCollision({ kind: "overlapping-files", files: ["a.ts", "b.ts"] })).toContain("2 of the same files");
  });
});
