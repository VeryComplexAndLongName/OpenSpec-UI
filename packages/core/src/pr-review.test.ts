import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanPrReviewCommit, readPrReview } from "./pr-review.js";
import type { PullRequestsByBranch } from "./gh-pr-gateway.js";
import type { AuditEntry } from "./security.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";

vi.setConfig({ testTimeout: 60_000 });

const exec = promisify(execFile);
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
});

async function git(root: string, ...args: string[]): Promise<string> {
  const { stdout } = await exec("git", [...await gitIsolationArgs(), "-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", ...args], { cwd: root });
  return stdout.trim();
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "osw-pr-review-"));
  roots.push(root);
  await git(root, "init", "-b", "main");
  const changeDir = path.join(root, "openspec", "changes", "demo");
  await mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, "proposal.md"), "# Demo\n");
  await git(root, "add", ".");
  await git(root, "commit", "-m", "Default branch");
  const main = await git(root, "rev-parse", "HEAD");
  await git(root, "switch", "-c", "release");
  await writeFile(path.join(root, "release.txt"), "Release only\n");
  await git(root, "add", "release.txt");
  await git(root, "commit", "-m", "Release branch");
  const release = await git(root, "rev-parse", "HEAD");
  await git(root, "switch", "-c", "demo");
  await writeFile(path.join(root, "implementation.txt"), "Reviewed implementation\n");
  await git(root, "add", "implementation.txt");
  await git(root, "commit", "-m", "Implement demo");
  const head = await git(root, "rev-parse", "HEAD");
  await git(root, "remote", "add", "origin", "https://example.invalid/owner/repo.git");
  return { root, changeDir, main, release, head };
}

function openTarget(base: string, head: string): Promise<PullRequestsByBranch> {
  return Promise.resolve({
    available: true, byBranch: new Map(),
    openTargets: new Map([["demo", [{ number: 4, baseBranch: "release", baseCommit: base, headCommit: head }]]]),
  });
}

describe("PR review", () => {
  it("compares the pinned local head with the open PR's non-default target", async () => {
    const { root, main, release, head } = await fixture();
    await writeFile(path.join(root, "implementation.txt"), "Uncommitted work\n");
    const report = await readPrReview(root, "demo", { pullRequests: () => openTarget(release, main) });
    expect(report.summary).toContain("PR #4 targets");
    expect(report.summary).toContain(release);
    expect(report.summary).toContain(head);
    expect(report.summary).toContain("Published PR head");
    expect(report.summary).toContain("Uncommitted working-tree changes are excluded");
    expect(report.summary).not.toContain("Reviewed implementation");
    expect(report.diff).toContain("+Reviewed implementation");
    expect(report.diff).not.toMatch(/release.txt|Uncommitted work/u);
    expect(await cleanPrReviewCommit(root)).toBeUndefined();
  });

  it("labels a preview and never falls back from a known missing or unrelated target", async () => {
    const { root, head } = await fixture();
    const preview = await readPrReview(root, "demo", { pullRequests: async () => ({ available: true, byBranch: new Map() }) });
    expect(preview.summary).toContain("Default-branch preview");
    expect(preview.summary).toContain("No open PR target");
    expect(preview.diff).toContain("+Release only");
    const missing = await readPrReview(root, "demo", { pullRequests: () => openTarget("f".repeat(40), head) });
    expect(missing.diff).toBeNull();
    expect(missing.summary).toContain("unavailable locally");
    expect(missing.summary).not.toContain("preview");
    await git(root, "switch", "--orphan", "unrelated");
    await git(root, "commit", "--allow-empty", "-m", "Unrelated");
    const unrelated = await git(root, "rev-parse", "HEAD");
    await git(root, "switch", "demo");
    const report = await readPrReview(root, "demo", { pullRequests: () => openTarget(unrelated, head) });
    expect(report.diff).toBeNull();
    expect(report.summary).toContain("No common ancestor");
  });

  it("reports retained mechanical and verify-agent evidence with their actual provenance", async () => {
    const { root, changeDir, head, main } = await fixture();
    expect(await cleanPrReviewCommit(root)).toBe(head);
    const source = { pullRequests: () => openTarget(main, head) };
    expect((await readPrReview(root, "demo", source)).summary).toContain("Mechanical checks: no result recorded.");
    const auditDir = path.join(root, ".openspec-ui");
    await mkdir(auditDir);
    const base: AuditEntry = { cwd: root, changeDir, runId: "check-run", agent: "verify-checks", timestamp: "2026-10-01T00:00:00Z", outcome: "completed", checksRan: 3, checksFailed: 1, reason: "raw command output" };
    const agent: AuditEntry = { cwd: root, changeDir, runId: "agent-run", agent: "codex-cli", timestamp: "2026-10-02T00:00:00Z", outcome: "failed", stage: "verify" };
    for (const [commit, label] of [[head, "reviewed commit"], [main, "historical commit"], [undefined, "unknown revision"]] as const) {
      await writeFile(path.join(auditDir, "audit.jsonl"), [base, { ...base, timestamp: "2026-10-03T00:00:00Z", checkedCommit: commit }, agent].map((entry) => JSON.stringify(entry)).join("\n"));
      const { summary } = await readPrReview(root, "demo", source);
      expect(summary).toContain(`2 passed, 1 failed (${label}`);
      expect(summary).toContain("agent-run");
      expect(summary).toContain("Verify agent: ` failed ` (unknown revision)");
      expect(summary).not.toContain("raw command output");
    }
  });
});
