import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanPrReviewCommit, prReviewMarkdown, readPrReview } from "./pr-review.js";
import type { Forge, PullRequestsByBranch } from "./gh-pr-gateway.js";
import { editJUnitMapping, importJUnit, readJUnitReview } from "./junit-evidence.js";
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
  it("retains the CI JUnit source and refuses to replace it from a stale review", async () => {
    const { root, head, main } = await fixture();
    const source = { forge: "GitLab" as const, repository: "team/app", execution: 7, pipeline: 33 };
    const readCiJUnit = vi.fn().mockResolvedValue({
      source, testedCommit: main, xml: '<testsuite><testcase name="expires"/></testsuite>',
    });
    const forge = () => Promise.resolve({ name: "GitLab", readCiJUnit } as unknown as Forge);
    const options = { forge, pullRequests: () => openTarget(main, head) };
    const report = await readPrReview(root, "demo", { ...options, ciJUnitImport: { head, execution: 7 } });
    expect(report.summary).toContain("job #7, pipeline #33");
    expect(report.summary).toContain("Historical report");
    expect(readCiJUnit).toHaveBeenCalledWith(7);
    await expect(readPrReview(root, "demo", { ...options, ciJUnitImport: { head: main, execution: 19 } })).rejects.toThrow("current PR Review");
    expect(readCiJUnit).toHaveBeenCalledTimes(1);
    expect((await readPrReview(root, "demo", options)).summary).toContain("job #7, pipeline #33");
  });

  it("previews and saves an exact JUnit mapping while rejecting changed evidence and duplicate identities", async () => {
    const { root, changeDir, main } = await fixture();
    const file = path.join(changeDir, "scenario-tests.json");
    const head = await git(root, "rev-parse", "HEAD");
    const scenario = { capability: "checkout", requirement: "Shipping", scenario: "Address changes" };
    const xml = '<testsuite><testcase classname="Shipping" name="updates"/><testcase name="duplicate"/><testcase name="duplicate"/></testsuite>';
    await importJUnit(root, "demo", { head, testedCommit: main, xml }, head);
    const choices = (await readJUnitReview(root, "demo", head, [scenario])).choices!;
    expect(choices.tests).toEqual([{ classname: "Shipping", name: "updates", state: "passed" }]);
    const selection = { head, reportId: choices.reportId, scenario, test: { classname: "Shipping", name: "updates" } };
    const preview = async () => {
      const result = await editJUnitMapping(root, "demo", head, { mode: "preview", selection }, choices);
      if (!("preview" in result)) throw new Error("Expected a mapping preview");
      return result.preview;
    };
    const save = (revision: string) => editJUnitMapping(root, "demo", head, { mode: "save", selection, revision }, choices);
    const planned = await preview();
    expect(planned.diff).toContain("+++ b/scenario-tests.json");
    await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(editJUnitMapping(root, "demo", head, { mode: "preview",
      selection: { ...selection, test: { classname: "", name: "duplicate" } } }, choices)).rejects.toThrow("unique testcase");
    await writeFile(file, '{"scenarios":[]}');
    await expect(save(planned.revision)).rejects.toThrow("mapping changed");
    const fresh = await preview();
    await importJUnit(root, "demo", { head, testedCommit: main, xml: "<testsuite/>" }, head);
    await expect(save(fresh.revision)).rejects.toThrow("JUnit report moved");
    const replacement = (await readJUnitReview(root, "demo", head, [scenario])).choices;
    expect(replacement).toBeUndefined();
    await importJUnit(root, "demo", { head, testedCommit: main, xml }, head);
    const updated = (await readJUnitReview(root, "demo", head, [scenario])).choices!;
    const newSelection = { ...selection, reportId: updated.reportId };
    const next = await editJUnitMapping(root, "demo", head, { mode: "preview", selection: newSelection }, updated);
    if (!("preview" in next)) throw new Error("Expected replacement mapping preview");
    expect(await editJUnitMapping(root, "demo", head, { mode: "save", selection: newSelection, revision: next.preview.revision }, updated))
      .toEqual({ saved: true });
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ scenarios: [{ ...selection.scenario, tests: [selection.test] }] });
  });

  it("imports JUnit for committed scenario mappings, retains it across reviews and rejects stale or invalid replacements", async () => {
    const { root, changeDir, main } = await fixture();
    const delta = path.join(changeDir, "specs", "checkout");
    await mkdir(delta, { recursive: true });
    await writeFile(path.join(delta, "spec.md"), "## ADDED Requirements\n### Requirement: Shipping\n#### Scenario: Address changes\n");
    await writeFile(path.join(changeDir, "scenario-tests.json"), JSON.stringify({ scenarios: [{
      capability: "checkout", requirement: "Shipping", scenario: "Address changes", tests: [{ classname: "ShippingTest", name: "updates address" }],
    }] }));
    await git(root, "add", "."); await git(root, "commit", "-m", "Map scenario to testcase");
    const head = await git(root, "rev-parse", "HEAD");
    const sources = { pullRequests: () => openTarget(main, head) };
    const xml = '<testsuite><testcase classname="ShippingTest" name="updates address"><system-out>private-output</system-out></testcase></testsuite>';
    const imported = await readPrReview(root, "demo", { ...sources, junitImport: { head, testedCommit: head, xml } });
    expect(imported.summary).toContain("Scenario test results (JUnit)");
    expect(imported.summary).toContain("updates address `: passed");
    expect(imported.summary).toContain("User-declared tested commit");
    expect((await readPrReview(root, "demo", sources)).summary).toContain("updates address `: passed");
    expect(await git(root, "status", "--porcelain")).toBe("");
    const store = path.join(root, ".git", "openspec-ui", "junit");
    const files = await readdir(store);
    expect(await readFile(path.join(store, files[0]!), "utf8")).not.toContain("private-output");
    await expect(readPrReview(root, "demo", { ...sources, junitImport: { head, testedCommit: head, xml: "<!DOCTYPE testsuite><testsuite/>" } })).rejects.toThrow("OSW-CHG-014");
    await expect(readPrReview(root, "demo", { ...sources, junitImport: { head, testedCommit: "c".repeat(40), xml } })).rejects.toThrow("OSW-CHG-016");
    await git(root, "commit", "--allow-empty", "-m", "Later revision");
    await expect(readPrReview(root, "demo", { ...sources, junitImport: { head, testedCommit: head, xml } })).rejects.toThrow("OSW-CHG-015");
    expect((await readPrReview(root, "demo", sources)).summary).toContain("historical passed");
    const linked = path.join(root, "linked");
    await git(root, "worktree", "add", "--detach", linked, "HEAD");
    expect((await readPrReview(linked, "demo")).summary).toContain("historical passed");
  });

  it("reviews declared scope from committed mappings with both rename paths and incremental endpoints", async () => {
    const { root, changeDir, main } = await fixture();
    const source = { pullRequests: () => openTarget(main, main) };
    await mkdir(path.join(root, "src")); await mkdir(path.join(root, "outside"));
    const scope = path.join(changeDir, "change-scope.json");
    await writeFile(scope, JSON.stringify({ paths: ["src/"] }));
    await writeFile(path.join(root, "src", "old.ts"), "exported\n");
    await writeFile(path.join(root, "outside", "old.ts"), "imported\n");
    await git(root, "add", "."); await git(root, "commit", "-m", "Declare implementation scope");
    const reviewed = await git(root, "rev-parse", "HEAD");
    await readPrReview(root, "demo", { ...source, markReviewedCommit: reviewed });
    await git(root, "mv", "src/old.ts", "outside/exported.ts");
    await git(root, "mv", "outside/old.ts", "src/imported.ts");
    await git(root, "commit", "-m", "Move files across the scope boundary");
    await writeFile(scope, JSON.stringify({ paths: ["src/", "outside/"] }));
    const dirty = await git(root, "status", "--porcelain");
    const report = await readPrReview(root, "demo", { ...source, sinceLastReview: true });
    expect(report.summary).toContain("Outside declared scope: 2 paths");
    expect(report.summary).toContain("` outside/old.ts `");
    expect(report.summary).toContain("` outside/exported.ts `");
    expect(report.summary).not.toContain("` implementation.txt `");
    expect(report.summary).not.toContain("Review its diff before treating");
    expect(report.summary).toContain("Advisory comparison of committed paths only");
    expect(await git(root, "status", "--porcelain")).toBe(dirty);
    await git(root, "add", "."); await git(root, "commit", "-m", "Broaden the declared scope");
    const broadened = await readPrReview(root, "demo", { ...source, sinceLastReview: true });
    expect(broadened.summary).toContain("Outside declared scope: 0 paths");
    expect(broadened.summary).toContain("Review its diff before treating these paths as agreed scope");
  });

  it("uses the origin forge's check detail and exposes matching scenario choices", async () => {
    const { root, changeDir, release } = await fixture();
    const delta = path.join(changeDir, "specs", "checkout");
    await mkdir(delta, { recursive: true });
    await writeFile(path.join(delta, "spec.md"), "## ADDED Requirements\n### Requirement: Shipping\n#### Scenario: Address changes\n");
    await git(root, "add", ".");
    await git(root, "commit", "-m", "Describe address changes");
    const head = await git(root, "rev-parse", "HEAD");
    const reviewChecks = vi.fn<NonNullable<Forge["reviewChecks"]>>(async () => ({
      kind: "checks", head, checks: [{ name: "Address tests", state: "success", link: "https://gitlab.com/group/app/-/jobs/7" }],
      expected: [], resultsComplete: true, rulesComplete: false,
    }));
    const forge: Forge = {
      name: "GitLab", pullRequestsByBranch: () => openTarget(release, head), reviewChecks,
      openPullRequest: vi.fn(), checksOf: vi.fn(), mergeNow: vi.fn(),
    };
    const report = await readPrReview(root, "demo", { forge: async () => forge, githubChecks: true });
    expect(reviewChecks).toHaveBeenCalledWith({ number: 4, baseBranch: "release", baseCommit: release, headCommit: head });
    expect(report.summary).toContain("### GitLab checks");
    expect(report.summary).toContain("Merge request #4");
    expect(report.summary).toContain("https://gitlab.com/group/app/-/jobs/7");
    expect(report.mappingChoices).toEqual({
      checks: ["Address tests"], scenarios: [{ capability: "checkout", requirement: "Shipping", scenario: "Address changes" }],
    });
  });

  it("records the displayed commit locally and compares later edits in a linked worktree", async () => {
    const { root, changeDir, main, head } = await fixture();
    const source = { pullRequests: () => openTarget(main, head) };
    expect((await readPrReview(root, "demo", { ...source, sinceLastReview: true })).diff).toBeNull();
    expect((await readPrReview(root, "demo", { ...source, markReviewedCommit: head })).lastReviewed).toBe(head);
    await writeFile(path.join(changeDir, "proposal.md"), "# Revised plan\n");
    await git(root, "commit", "-am", "Revise the plan");
    const revised = await git(root, "rev-parse", "HEAD");
    await expect(readPrReview(root, "demo", { ...source, markReviewedCommit: head })).rejects.toThrow("head changed");
    const linked = path.join(root, "review-worktree");
    await git(root, "worktree", "add", "--detach", linked, revised);
    const followup = await readPrReview(linked, "demo", { ...source, sinceLastReview: true });
    expect(followup).toMatchObject({ lastReviewed: head, head: revised, sinceLastReview: true });
    expect(followup.diff).toContain("+# Revised plan");
    expect(followup.diff).not.toContain("Reviewed implementation");
    expect((await readPrReview(root, "demo", source)).diff).toContain("+Reviewed implementation");
  });

  it("lists scenarios and check associations from the reviewed commit", async () => {
    const { root, changeDir, main } = await fixture();
    const delta = path.join(changeDir, "specs", "checkout");
    await mkdir(delta, { recursive: true });
    await writeFile(path.join(delta, "spec.md"), "## ADDED Requirements\n### Requirement: Shipping\n#### Scenario: Address changes\n");
    const mapping = path.join(changeDir, "scenario-checks.json");
    await writeFile(mapping, JSON.stringify({ scenarios: [{
      capability: "checkout", requirement: "Shipping", scenario: "Address changes", checks: ["build"],
    }] }));
    await git(root, "add", ".");
    await git(root, "commit", "-m", "Add the shipping scenario");
    await writeFile(mapping, "{dirty");
    const report = await readPrReview(root, "demo", { pullRequests: async () => openTarget(main, main) });
    expect(report.summary).toContain("### Scenario evidence");
    expect(report.summary).toContain("Address changes");
    expect(report.summary).toContain("No GitHub result read");
    expect(report.summary).not.toContain("invalid format");
  });

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

describe("CI repair brief in PR Review", () => {
  it("forwards explicit diagnosis to the forge and returns a historical-head task to both hosts", async () => {
    const { root, head, release } = await fixture();
    const published = "a".repeat(40);
    const reviewChecks = vi.fn<NonNullable<Forge["reviewChecks"]>>(async () => ({ kind: "checks", head: published,
      checks: [{ name: "tests", state: "failed", failureDetails: { messages: ["test.ts:42: Assertion failed"], partial: false } }],
      expected: [], resultsComplete: true, rulesComplete: true,
    }));
    const forge: Forge = { name: "GitLab", pullRequestsByBranch: () => openTarget(release, published), reviewChecks,
      openPullRequest: vi.fn(), checksOf: vi.fn(), mergeNow: vi.fn() };
    const report = await readPrReview(root, "demo", { forge: async () => forge, prepareCiRepairTask: true });
    expect(reviewChecks).toHaveBeenCalledWith({ number: 4, baseBranch: "release", baseCommit: release, headCommit: published }, { failureDetails: true });
    expect(report.ciRepairTask).toContain(head);
    expect(report.ciRepairTask).toContain(published);
    expect(report.ciRepairTask).toContain("Historical/different revision");
    expect(report.summary).toContain("test.ts:42: Assertion failed");
    expect(prReviewMarkdown(report)).toContain(report.ciRepairTask);
    expect(await git(root, "status", "--porcelain")).toBe("");
    expect(forge.openPullRequest).not.toHaveBeenCalled();
  });
});
