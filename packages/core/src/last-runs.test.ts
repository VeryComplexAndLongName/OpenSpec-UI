import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lastRunsOf, readLastRuns } from "./last-runs.js";
import { FileAuditLog, auditLogPath, type AuditEntry } from "./security.js";

// a-card-says-what-its-change-is-doing: pure over entries except the two
// reads that open a temporary log.
// every-varying-check-has-a-budget: file writes and reads only, no git
// process and no agent. Measured 2026-09-14 at 30ms and 56ms for the
// whole file of seven tests, in two runs.
vi.setConfig({ testTimeout: 15_000 });

const CHANGE = "/repo/openspec/changes/demo";

function entry(partial: Partial<AuditEntry> & Pick<AuditEntry, "runId" | "outcome" | "timestamp">): AuditEntry {
  return { agent: "claude-cli", cwd: "/repo", changeDir: CHANGE, ...partial } as AuditEntry;
}

const temporary: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function logIn(root: string, entries: readonly AuditEntry[]): Promise<string> {
  const file = auditLogPath(root);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, entries.map((line) => JSON.stringify(line)).join("\n") + "\n", "utf8");
  return file;
}

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "last-runs-"));
  temporary.push(dir);
  return dir;
}

describe("lastRunsOf", () => {
  it("reports a chain that failed at verify, with its reason and what it spent", () => {
    const report = lastRunsOf([
      entry({ runId: "c1", outcome: "started", timestamp: "2026-09-14T10:00:00.000Z", stage: "apply" }),
      entry({ runId: "c1", outcome: "completed", timestamp: "2026-09-14T10:05:00.000Z", stage: "apply", usage: { costUsd: 0.5 } }),
      entry({ runId: "c1", outcome: "started", timestamp: "2026-09-14T10:05:01.000Z", stage: "verify" }),
      entry({ runId: "c1", outcome: "failed", timestamp: "2026-09-14T10:06:00.000Z", stage: "verify", reason: "the agent gave up", usage: { costUsd: 0.25 } }),
      entry({ runId: "c1", agent: "chain", outcome: "failed", timestamp: "2026-09-14T10:06:00.010Z", stage: "verify", reason: "verify: the agent gave up" }),
    ]);

    expect(report.byChange.demo).toEqual({
      runId: "c1",
      outcome: "failed",
      stage: "verify",
      endedAt: "2026-09-14T10:06:00.010Z",
      reason: "verify: the agent gave up",
      costUsd: 0.75,
    });
  });

  it("takes a chain cancelled at a checkpoint from the chain's ending, not its completed stage", () => {
    const report = lastRunsOf([
      entry({ runId: "c1", outcome: "started", timestamp: "2026-09-14T10:00:00.000Z", stage: "propose" }),
      entry({ runId: "c1", outcome: "completed", timestamp: "2026-09-14T10:01:00.000Z", stage: "propose" }),
      entry({ runId: "c1", agent: "chain", outcome: "cancelled", timestamp: "2026-09-14T10:09:00.000Z", stage: "propose" }),
    ]);

    expect(report.byChange.demo).toMatchObject({ outcome: "cancelled", stage: "propose", endedAt: "2026-09-14T10:09:00.000Z" });
    expect(report.byChange.demo).not.toHaveProperty("reason");
  });

  it("gives no cost for a run that reported none", () => {
    const report = lastRunsOf([
      entry({ runId: "r1", outcome: "started", timestamp: "2026-09-14T10:00:00.000Z", stage: "apply" }),
      entry({ runId: "r1", outcome: "completed", timestamp: "2026-09-14T10:01:00.000Z", stage: "apply" }),
    ]);

    expect(report.byChange.demo).not.toHaveProperty("costUsd");
  });

  it("skips a started run with no ending, in favour of the previous run that ended", () => {
    const report = lastRunsOf([
      entry({ runId: "r1", outcome: "started", timestamp: "2026-09-14T10:00:00.000Z", stage: "apply" }),
      entry({ runId: "r1", outcome: "completed", timestamp: "2026-09-14T10:01:00.000Z", stage: "apply" }),
      entry({ runId: "r2", outcome: "started", timestamp: "2026-09-14T11:00:00.000Z", stage: "verify" }),
    ]);

    expect(report.byChange.demo).toMatchObject({ runId: "r1", outcome: "completed", stage: "apply" });
  });

  it("reads a log written before chain endings existed from its last terminal entry", () => {
    const report = lastRunsOf([
      entry({ runId: "c1", outcome: "started", timestamp: "2026-09-10T10:00:00.000Z", stage: "apply" }),
      entry({ runId: "c1", outcome: "completed", timestamp: "2026-09-10T10:05:00.000Z", stage: "apply" }),
      entry({ runId: "c1", outcome: "started", timestamp: "2026-09-10T10:05:01.000Z", stage: "verify" }),
      entry({ runId: "c1", outcome: "cancelled", timestamp: "2026-09-10T10:35:01.000Z", stage: "verify", reason: "maxStageSeconds is 1800s" }),
    ]);

    expect(report.byChange.demo).toEqual({
      runId: "c1",
      outcome: "cancelled",
      stage: "verify",
      endedAt: "2026-09-10T10:35:01.000Z",
      reason: "maxStageSeconds is 1800s",
    });
  });
});

describe("readLastRuns", () => {
  it("finds a run recorded in the log of the change's own worktree", async () => {
    const main = await tempDir();
    const worktree = await tempDir();
    await logIn(worktree, [
      entry({ runId: "w1", cwd: worktree, changeDir: path.join(worktree, "openspec", "changes", "in-its-worktree"), outcome: "started", timestamp: "2026-09-14T10:00:00.000Z", stage: "apply" }),
      entry({ runId: "w1", cwd: worktree, changeDir: path.join(worktree, "openspec", "changes", "in-its-worktree"), outcome: "failed", timestamp: "2026-09-14T10:01:00.000Z", stage: "apply", reason: "no" }),
    ]);
    const git = { worktreeList: async () => [{ path: main }, { path: worktree }] } as never;

    const report = await readLastRuns({ workspaceRoot: main, git });

    expect(report.byChange["in-its-worktree"]).toMatchObject({ runId: "w1", outcome: "failed", stage: "apply" });
  });

  it("parses an unchanged log once across two reads, and again once it grows", async () => {
    const root = await tempDir();
    const file = await logIn(root, [
      entry({ runId: "r1", outcome: "started", timestamp: "2026-09-14T10:00:00.000Z", stage: "apply" }),
      entry({ runId: "r1", outcome: "completed", timestamp: "2026-09-14T10:01:00.000Z", stage: "apply" }),
    ]);
    const git = { worktreeList: async () => [] } as never;
    const parse = vi.spyOn(FileAuditLog.prototype, "readEntries");

    await readLastRuns({ workspaceRoot: root, git });
    const second = await readLastRuns({ workspaceRoot: root, git });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(second.byChange.demo).toMatchObject({ runId: "r1" });

    await appendFile(file, JSON.stringify(entry({ runId: "r2", outcome: "failed", timestamp: "2026-09-14T11:00:00.000Z", stage: "verify" })) + "\n", "utf8");
    const third = await readLastRuns({ workspaceRoot: root, git });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(third.byChange.demo).toMatchObject({ runId: "r2", outcome: "failed" });
  });
});
