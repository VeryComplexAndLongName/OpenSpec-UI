import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangeUsageRefusal, readChangeUsageReport } from "./change-usage-report.js";
import type { AuditEntry } from "./security.js";

// Fixture I/O varies with host load. Measured 2026-10-24: all 11 cases
// took 115ms; cleanup has its own budget rather than the test's budget.
vi.setConfig({ testTimeout: 15_000, hookTimeout: 30_000 });

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!path.resolve(root).startsWith(path.join(os.tmpdir(), "change-usage-"))) throw new Error("Unexpected fixture root");
    await rm(root, { recursive: true, force: true });
  }
});

async function fixture(archived = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), "change-usage-"));
  roots.push(root);
  const name = archived ? "archive/2026-10-24-demo" : "demo";
  await mkdir(path.join(root, "openspec", "changes", name), { recursive: true });
  await mkdir(path.join(root, ".openspec-ui"));
  const git = { worktreeList: vi.fn().mockResolvedValue([]) };
  const options = { workspaceRoot: root, changeName: "demo", git };
  const entry: AuditEntry = {
    agent: "codex-cli-acp", runId: "chain", invocationId: "one", outcome: "completed",
    cwd: root, timestamp: "2026-10-24T00:00:00Z", changeDir: path.join(root, "openspec", "changes", "demo"),
    usage: { inputTokens: 10, outputTokens: 2, cacheReadInputTokens: 86656, thoughtTokens: 3 },
  };
  const audit = (entries: AuditEntry[]) => writeFile(path.join(root, ".openspec-ui", "audit.jsonl"), entries.map((row) => JSON.stringify(row)).join("\n"));
  return { root, options, entry, audit };
}

describe("readChangeUsageReport", () => {
  it("reads an active change without requiring tasks.md", async () => {
    const { options, entry, audit } = await fixture();
    await audit([entry]);
    const report = await readChangeUsageReport(options);
    expect(report.recordedRunCount).toBe(1);
    expect(report.totalsByAgent[entry.agent]).toMatchObject({ inputTokens: 10, cacheReadInputTokens: 86656, thoughtTokens: 3 });
    expect(report.totalsByAgent[entry.agent]).not.toHaveProperty("costUsd");
  });

  it("reads archive aliases and retained paths from a removed worktree without mixing another change", async () => {
    const { root, options, entry, audit } = await fixture(true);
    await audit([
      { ...entry, changeDir: "C:\\removed-worktree\\openspec\\changes\\demo" },
      { ...entry, invocationId: "two", changeDir: "/removed/other-worktree/openspec/changes/demo", usage: { inputTokens: 20 } },
      { ...entry, runId: "archived-run", invocationId: "three", changeDir: path.join(root, "openspec", "changes", "archive", "2026-10-24-demo"), usage: { inputTokens: 5 } },
      { ...entry, invocationId: "other", changeDir: path.join(root, "openspec", "changes", "other"), usage: { inputTokens: 1000, costUsd: 100 } },
      { ...entry, invocationId: "prefix", changeDir: path.join(root, "openspec", "changes", "demo-other"), usage: { inputTokens: 1000 } },
    ]);
    for (const changeName of ["demo", "2026-10-24-demo"]) {
      const report = await readChangeUsageReport({ ...options, changeName });
      expect(report).toMatchObject({ changeName: "demo", archiveName: "2026-10-24-demo", recordedRunCount: 2 });
      expect(report.totalsByAgent[entry.agent]).toMatchObject({ inputTokens: 35, runCount: 2, invocationCount: 3 });
      expect(report.totalsByAgent[entry.agent]).not.toHaveProperty("costUsd");
    }
  });

  it("includes a change known only in a sibling worktree and its log", async () => {
    const { root, options, entry, audit } = await fixture();
    const sibling = await mkdtemp(path.join(os.tmpdir(), "change-usage-"));
    roots.push(sibling);
    await mkdir(path.join(sibling, "openspec", "changes", "sibling-change"), { recursive: true });
    await mkdir(path.join(sibling, ".openspec-ui"));
    options.git.worktreeList.mockResolvedValue([{ path: root }, { path: sibling }]);
    await audit([]);
    await writeFile(path.join(sibling, ".openspec-ui", "audit.jsonl"), JSON.stringify({ ...entry, changeDir: path.join(sibling, "openspec", "changes", "sibling-change"), usage: { costUsd: 2 } }));
    expect((await readChangeUsageReport({ ...options, changeName: "sibling-change" })).totalsByAgent[entry.agent]?.costUsd).toBe(2);
  });

  it("returns no recorded runs for a known archive with no retained log", async () => {
    const { options } = await fixture(true);
    expect(await readChangeUsageReport(options)).toMatchObject({ recordedRunCount: 0, totalsByAgent: {}, unmeasuredRunCount: 0, unmeasuredInvocationCount: 0 });
  });

  it("refuses an unknown change even if a similarly named audit record exists", async () => {
    const { options, entry, audit } = await fixture();
    await audit([entry]);
    await expect(readChangeUsageReport({ ...options, changeName: "missing" })).rejects.toThrow(ChangeUsageRefusal);
  });

  it.each(["../demo", "archive/demo", "", "archive", "C:\\demo"])("refuses invalid name %s before consulting git", async (changeName) => {
    const { options } = await fixture();
    await expect(readChangeUsageReport({ ...options, changeName })).rejects.toThrow(ChangeUsageRefusal);
    expect(options.git.worktreeList).not.toHaveBeenCalled();
  });

  it("refuses reused archive generations rather than guessing from old active paths", async () => {
    const { root, options } = await fixture(true);
    await mkdir(path.join(root, "openspec", "changes", "archive", "2026-10-23-demo"));
    for (const changeName of ["demo", "2026-10-24-demo"]) {
      await expect(readChangeUsageReport({ ...options, changeName })).rejects.toThrow(/Ambiguous change demo/);
    }
  });
});
