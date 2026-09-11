import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readRepositoryAuditEntries, repositoryWorkspaceRoots } from "./repository-audit.js";
import type { GitWrapper } from "./git.js";
import { auditLogPath, type AuditEntry } from "./security.js";
import { WorkspaceLeaseManager } from "./workspace-lease.js";

// every-varying-check-has-a-budget: file writes and reads only, no git
// process and no agent. Measured 2026-09-11 under 60ms for the slowest.
vi.setConfig({ testTimeout: 15_000 });

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-repo-audit-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function fakeGit(paths: string[] | Error): GitWrapper {
  return {
    worktreeList: async () => {
      if (paths instanceof Error) throw paths;
      return paths.map((p) => ({ path: p }));
    },
  } as unknown as GitWrapper;
}

function entry(changeName: string, costUsd: number): AuditEntry {
  return {
    timestamp: "2026-09-11T00:00:00.000Z",
    runId: `run-${costUsd}`,
    agentId: "claude-cli",
    command: "implement",
    cwd: "/anywhere",
    outcome: "completed",
    changeName,
    usage: { costUsd },
  } as unknown as AuditEntry;
}

/** Writes the log file directly rather than through `FileAuditLog`.
 *
 * `record()` queues its write and `readEntries()` does not await that
 * queue, so going through the writer here would race the read under
 * test. What is under test is the reading across directories; the
 * writer's own behaviour is its own file's business. */
async function recordUsage(root: string, changeName: string, costUsd: number): Promise<void> {
  const file = auditLogPath(root);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(entry(changeName, costUsd))}\n`, "utf8");
}

describe("readRepositoryAuditEntries", () => {
  it("counts what a sibling working directory recorded", async () => {
    // The whole point: a ceiling measured per working directory would
    // permit itself once per directory, so three worktrees would silently
    // allow three times what was configured.
    const main = await temporaryRoot();
    const sibling = await temporaryRoot();
    await recordUsage(main, "a-change", 3);
    await recordUsage(sibling, "a-change", 4);

    const entries = await readRepositoryAuditEntries({
      git: fakeGit([main, sibling]),
      workspaceRoot: main,
    });

    const total = entries.reduce((sum, e) => sum + ((e as { usage?: { costUsd?: number } }).usage?.costUsd ?? 0), 0);
    expect(total).toBe(7);
  });

  it("skips a sibling whose log cannot be read, rather than failing the run", async () => {
    const main = await temporaryRoot();
    await recordUsage(main, "a-change", 3);
    const broken = await temporaryRoot();
    // A directory where the log should be, which is not a readable file.
    await mkdir(path.dirname(auditLogPath(broken)), { recursive: true });
    await mkdir(auditLogPath(broken), { recursive: true });

    const entries = await readRepositoryAuditEntries({
      git: fakeGit([main, broken]),
      workspaceRoot: main,
    });

    // A removed worktree, or one belonging to somebody else, must not
    // stop this run from starting.
    expect(entries).toHaveLength(1);
  });

  it("counts a directory once when git lists the one it was given", async () => {
    const main = await temporaryRoot();
    await recordUsage(main, "a-change", 5);

    const entries = await readRepositoryAuditEntries({
      git: fakeGit([main]),
      workspaceRoot: main,
    });

    expect(entries).toHaveLength(1);
  });

  it("falls back to its own directory when the worktree list cannot be read", async () => {
    // A plain directory that is not a git repository still has its own
    // log, and that is exactly what was summed before this existed.
    const main = await temporaryRoot();
    await recordUsage(main, "a-change", 2);

    const entries = await readRepositoryAuditEntries({
      git: fakeGit(new Error("not a git repository")),
      workspaceRoot: main,
    });

    expect(entries).toHaveLength(1);
  });
});

describe("repositoryWorkspaceRoots", () => {
  it("includes the given root exactly once", async () => {
    const main = await temporaryRoot();
    const sibling = await temporaryRoot();

    const roots = await repositoryWorkspaceRoots({ git: fakeGit([main, sibling]), workspaceRoot: main });

    expect(roots.filter((root) => root === path.resolve(main))).toHaveLength(1);
    expect(roots).toHaveLength(2);
  });
});

describe("the lease is per working directory (changes-run-side-by-side)", () => {
  it("lets two directories of one repository each hold their own", async () => {
    // This is the claim the whole change rests on: worktrees are the
    // isolation ADR 0010 decision 2 named, so two chains in two of them
    // take two leases and never meet.
    const first = await temporaryRoot();
    const second = await temporaryRoot();

    const a = await new WorkspaceLeaseManager(first, { hostKind: "cli" }).acquireOrRenew();
    const b = await new WorkspaceLeaseManager(second, { hostKind: "cli" }).acquireOrRenew();

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
  });

  it("still refuses a second run in one directory", async () => {
    const root = await temporaryRoot();
    await new WorkspaceLeaseManager(root, { hostKind: "cli" }).acquireOrRenew();

    const second = await new WorkspaceLeaseManager(root, { hostKind: "cli" }).acquireOrRenew();

    // Nothing about the lease is relaxed: the isolation is the separate
    // directory, not a weaker guard.
    expect(second.ok).toBe(false);
  });
});
