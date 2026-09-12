import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auditLogPath } from "./security.js";
import { harvestWorktree } from "./worktree-harvest.js";

// every-varying-check-has-a-budget: no subprocess, no git — a handful of
// small file writes. Measured 2026-09-12 under 30ms for the slowest.
vi.setConfig({ testTimeout: 15_000 });

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-harvest-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function writeLog(root: string, entries: Array<Record<string, unknown>>): Promise<void> {
  const filePath = auditLogPath(root);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
}

async function readLog(root: string): Promise<Array<Record<string, unknown>>> {
  try {
    return (await readFile(auditLogPath(root), "utf8"))
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch {
    return [];
  }
}

function entry(runId: string, cwd: string): Record<string, unknown> {
  return { runId, agent: "claude-cli", outcome: "completed", cwd, timestamp: "2026-09-12T10:00:00.000Z" };
}

describe("harvestWorktree", () => {
  it("takes a working directory's run history into the repository's own", async () => {
    const repository = await temporaryRoot();
    const worktree = await temporaryRoot();
    await writeLog(repository, [entry("here-1", repository)]);
    await writeLog(worktree, [entry("there-1", worktree), entry("there-2", worktree)]);

    const result = await harvestWorktree({ repositoryRoot: repository, worktreePath: worktree });

    expect(result.entriesTaken).toBe(2);
    const merged = await readLog(repository);
    expect(merged.map((e) => e.runId)).toEqual(["here-1", "there-1", "there-2"]);
    // Each entry says where it ran, so a combined log stays unambiguous
    // without anything being rewritten.
    expect(merged.map((e) => e.cwd)).toEqual([repository, worktree, worktree]);
  });

  it("takes nothing twice", async () => {
    const repository = await temporaryRoot();
    const worktree = await temporaryRoot();
    await writeLog(worktree, [entry("there-1", worktree)]);

    const first = await harvestWorktree({ repositoryRoot: repository, worktreePath: worktree });
    const second = await harvestWorktree({ repositoryRoot: repository, worktreePath: worktree });

    // A person may well run the command again after one failed for some
    // other reason; the second run must not double the history.
    expect([first.entriesTaken, second.entriesTaken]).toEqual([1, 0]);
    expect((await readLog(repository)).length).toBe(1);
  });

  it("takes nothing, and says nothing was left, from a directory that recorded nothing", async () => {
    const repository = await temporaryRoot();
    const worktree = await temporaryRoot();

    const result = await harvestWorktree({ repositoryRoot: repository, worktreePath: worktree });

    expect(result).toEqual({ entriesTaken: 0, failureArtifacts: 0, discarded: [] });
  });

  it("keeps a line whose run cannot be identified rather than dropping it", async () => {
    const repository = await temporaryRoot();
    const worktree = await temporaryRoot();
    await mkdir(path.dirname(auditLogPath(worktree)), { recursive: true });
    await writeFile(auditLogPath(worktree), "{not json at all}\n", "utf8");

    const result = await harvestWorktree({ repositoryRoot: repository, worktreePath: worktree });

    // It is evidence of something, and this is the last chance anybody
    // has to look at it.
    expect(result.entriesTaken).toBe(1);
  });

  it("names the rollback data and the run journal it is leaving behind", async () => {
    const repository = await temporaryRoot();
    const worktree = await temporaryRoot();
    const own = path.join(worktree, ".openspec-ui");
    await mkdir(path.join(own, "checkpoints", "session-1"), { recursive: true });
    await mkdir(path.join(own, "checkpoints", "session-2"), { recursive: true });
    await writeFile(path.join(own, "workbench-runs.json"), "{}", "utf8");

    const result = await harvestWorktree({ repositoryRoot: repository, worktreePath: worktree });

    // Named, not taken: a destroyed thing that was announced is a
    // decision; one that was not is a discovery.
    expect(result.discarded).toHaveLength(2);
    expect(result.discarded.join(" ")).toContain("run journal");
    expect(result.discarded.join(" ")).toContain("2 checkpoints");
  });

  it("says nothing about the lease", async () => {
    const repository = await temporaryRoot();
    const worktree = await temporaryRoot();
    const own = path.join(worktree, ".openspec-ui");
    await mkdir(own, { recursive: true });
    await writeFile(path.join(own, "workspace.lease.json"), "{}", "utf8");

    const result = await harvestWorktree({ repositoryRoot: repository, worktreePath: worktree });

    // Ephemeral by construction: there is nothing to say about it, and
    // naming it would be noise in a list a person is meant to read.
    expect(result.discarded).toEqual([]);
  });

  it("does not need the repository to have a log already", async () => {
    const repository = await temporaryRoot();
    const worktree = await temporaryRoot();
    await writeLog(worktree, [entry("there-1", worktree)]);

    const result = await harvestWorktree({ repositoryRoot: repository, worktreePath: worktree });

    expect(result.entriesTaken).toBe(1);
    expect((await readLog(repository)).map((e) => e.runId)).toEqual(["there-1"]);
  });
});

describe("harvestWorktree — failure artifacts", () => {
  it("takes what the browser suite kept from a failure", async () => {
    const repository = await temporaryRoot();
    const worktree = await temporaryRoot();
    const results = path.join(worktree, "packages", "server", "test-results");
    await mkdir(path.join(results, "a-failed-spec"), { recursive: true });
    await writeFile(path.join(results, "a-failed-spec", "trace.zip"), "not really a zip", "utf8");

    const result = await harvestWorktree({ repositoryRoot: repository, worktreePath: worktree });

    // Playwright keeps these on failure only, so their existence is the
    // signal that somebody will want them.
    expect(result.failureArtifacts).toBe(1);
    const taken = path.join(
      repository, ".openspec-ui", "harvested-test-results", path.basename(worktree), "a-failed-spec", "trace.zip",
    );
    expect(await readFile(taken, "utf8")).toBe("not really a zip");
  });

  it("takes none where nothing failed", async () => {
    const repository = await temporaryRoot();
    const worktree = await temporaryRoot();

    expect((await harvestWorktree({ repositoryRoot: repository, worktreePath: worktree })).failureArtifacts).toBe(0);
  });
});
