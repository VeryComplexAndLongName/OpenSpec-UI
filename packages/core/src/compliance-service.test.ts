import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, expect, it, vi } from "vitest";
import { ComplianceService, complianceSurveyObservations, groupComplianceChanges } from "./compliance-service.js";
import type { WorktreeSurvey } from "./worktree-survey-facts.js";
import { ComplianceStore, complianceRepositoryIdentity } from "./compliance-store.js";

vi.setConfig({ testTimeout: 10_000 });
const directories: string[] = [];
afterEach(async () => { vi.useRealTimers(); for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function fixture() {
    const container = await mkdtemp(path.join(os.tmpdir(), "compliance-service-"));
    directories.push(container);
    const root = path.join(container, "repo");
    await mkdir(path.join(root, ".git"), { recursive: true });
    await mkdir(path.join(root, "openspec", "changes", "demo"), { recursive: true });
    const check = vi.fn(async () => (await readFile(path.join(root, ".gitignore"), "utf8").catch(() => "")).includes("/.openspec-ui/"));
    const store = new ComplianceStore(await complianceRepositoryIdentity(root), path.join(container, "state"));
    return { root, store, check, service: new ComplianceService(root, store, check) };
}

it("opens cached results without checking, creating state or changing files", async () => {
    const { service, check } = await fixture();
    const reading = await service.read();
    expect(reading.pending).toBe(6);
    expect(reading.observations).toEqual([]);
    expect(check).not.toHaveBeenCalled();
});

it("deduplicates case-equivalent Windows worktree roots", async () => {
    const { service, root, store } = await fixture();
    const variant = process.platform === "win32" ? root.toUpperCase() : root;
    await service.observe([{ ruleId: "worktree-state", subject: variant, worktree: variant, producer: "survey", owner: "compliance",
        repository: store.identity, revision: "one", outcome: "pass", evidence: "Registered", checkedAt: new Date().toISOString() }]);
    expect((await service.read()).pending).toBe(6);
});

it("visits one registered worktree per step and resumes its cursor after reopening", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T10:00:00Z"));
    const { root, service, store } = await fixture();
    for (const name of ["first", "second"]) {
        const worktree = path.join(path.dirname(root), name);
        const gitdir = path.join(root, ".git", "worktrees", name);
        await mkdir(gitdir, { recursive: true });
        await mkdir(worktree);
        await writeFile(path.join(worktree, ".git"), `gitdir: ${gitdir}`);
        await writeFile(path.join(gitdir, "commondir"), "../..");
        await writeFile(path.join(gitdir, "gitdir"), path.join(worktree, ".git"));
    }
    const initial = await service.read();
    await service.savePolicy({ ...initial.policy, global: { enabled: false }, rules: { "worktree-inventory": { enabled: true } } }, initial.generation);
    const first = await service.readRemainingStep(true, false);
    expect(first.observations.filter(item => item.ruleId === "worktree-state")).toHaveLength(1);
    expect(first.observations.find(item => item.ruleId === "worktree-inventory")?.continuation).toBe(1);
    vi.setSystemTime(new Date("2026-10-11T10:00:06Z"));
    const reopened = new ComplianceService(root, store);
    const second = await reopened.readRemainingStep(true, false);
    expect(second.observations.filter(item => item.ruleId === "worktree-state")).toHaveLength(2);
    expect(second.pending).toBe(0);
});

it("does no background work by default and checks only one subject explicitly", async () => {
    const { service, check } = await fixture();
    expect((await service.readRemainingStep(false, true)).observations).toEqual([]);
    const reading = await service.readRemainingStep(true, false);
    expect(reading.observations).toHaveLength(1);
    expect((await service.readRemainingStep(true, false)).observations).toHaveLength(1);
    expect(check).not.toHaveBeenCalled();
});

it("reports active/archive collisions without deleting either copy", async () => {
    const { service, root } = await fixture();
    const archive = path.join(root, "openspec", "changes", "archive", "2026-10-11-demo");
    await mkdir(archive, { recursive: true });
    const initial = await service.read();
    await service.savePolicy({ ...initial.policy, global: { enabled: false }, rules: { "change-integrity": { enabled: true } } }, initial.generation);
    const reading = await service.readRemainingStep(true, false);
    const collision = reading.observations.find(item => item.ruleId === "change-integrity");
    expect(collision?.outcome).toBe("finding");
    expect(collision?.evidence).toContain("demo");
    expect(await readFile(path.join(root, ".gitignore"), "utf8").catch(() => "missing")).toBe("missing");
});

it("reports runtime paths with uncertain provenance without reading log contents", async () => {
    const { service, root } = await fixture();
    await mkdir(path.join(root, ".openspec-ui"));
    await writeFile(path.join(root, ".openspec-ui", "audit.jsonl"), "private-log-content");
    const initial = await service.read();
    await service.savePolicy({ ...initial.policy, global: { enabled: false }, rules: { "runtime-placement": { enabled: true } } }, initial.generation);
    const reading = await service.readRemainingStep(true, false);
    const item = reading.observations.find(item => item.ruleId === "runtime-placement");
    expect(item?.outcome).toBe("unknown");
    expect(item?.evidence).toContain("audit.jsonl");
    expect(JSON.stringify(reading)).not.toContain("private-log-content");
    expect(await readFile(path.join(root, ".openspec-ui", "audit.jsonl"), "utf8")).toBe("private-log-content");
});

it("offers missing declared README links without editing the README", async () => {
    const { service, root } = await fixture();
    const text = "# Active changes\n";
    await writeFile(path.join(root, "openspec", "README.md"), text);
    const initial = await service.read();
    await service.savePolicy({ ...initial.policy, global: { enabled: false }, rules: { "change-index": { enabled: true } } }, initial.generation);
    const reading = await service.readRemainingStep(true, false);
    expect(reading.observations[0]?.evidence).toContain("changes/demo/proposal.md");
    expect(await readFile(path.join(root, "openspec", "README.md"), "utf8")).toBe(text);
});

it("groups equal change ids across physical directories without treating copies as violations", () => {
    const survey = { directories: [
        { path: "/main", readable: true, changes: [{ changeName: "demo" }] },
        { path: "/work", readable: true, changes: [{ changeName: "demo" }, { changeName: "other" }] },
        { path: "/unknown", readable: false },
    ] } as unknown as WorktreeSurvey;
    const grouped = groupComplianceChanges(survey);
    expect(grouped).toHaveLength(2);
    expect(grouped.find(change => change.id === "demo")?.paths).toHaveLength(2);
});

it("converts stale worktree evidence without mutating the survey or inventing dirty paths", () => {
    const survey = { directories: [{ path: "/work", branch: "demo", ownChange: "demo", readable: true,
        changes: [{ changeName: "demo" }], runs: [], finishedWith: { reason: "merged", branch: "demo" } }] } as unknown as WorktreeSurvey;
    const before = JSON.stringify(survey);
    const observations = complianceSurveyObservations("repo", survey, "2026-10-11T10:00:00Z");
    expect(JSON.stringify(survey)).toBe(before);
    expect(observations.find(item => item.ruleId === "worktree-state")).toMatchObject({
        outcome: "finding", owner: "compliance", branch: "demo", path: "/work", change: "demo",
    });
    expect(observations[0]?.evidence).toContain("Sweep owns cleanup");
    expect(observations.find(item => item.ruleId === "change-copies")?.outcome).toBe("pass");
});

it("allows only a named ignore repair and preserves CRLF, logs and unrelated content", async () => {
    const { root, service, store } = await fixture();
    await writeFile(path.join(root, ".gitignore"), "*.log\r\n!important.log\r\n");
    await mkdir(path.join(root, ".openspec-ui"));
    await writeFile(path.join(root, ".openspec-ui", "audit.jsonl"), "evidence");
    await service.observe([{
        ruleId: "runtime-ignore", subject: root, producer: "test", owner: "compliance",
        repository: store.identity, revision: "one", outcome: "finding", evidence: "Missing rule", checkedAt: new Date().toISOString(), worktree: root
    }]);
    await service.repair("runtime-ignore", root);
    expect(await readFile(path.join(root, ".gitignore"), "utf8")).toBe("*.log\r\n!important.log\r\n/.openspec-ui/\r\n");
    expect(await readFile(path.join(root, ".openspec-ui", "audit.jsonl"), "utf8")).toBe("evidence");
    expect((await service.read()).observations.find(item => item.ruleId === "runtime-ignore")?.outcome).toBe("pass");
    await expect(service.repair("sweep-result", root)).rejects.toThrow(/permitted/);
});

it("validates settings and never permits Sweep repairs", async () => {
    const { service, root, store } = await fixture();
    const reading = await service.read();
    await expect(service.savePolicy({ ...reading.policy, rules: { arbitrary: { reaction: "autorepair" } } }, 0)).rejects.toThrow(/Unsupported/);
    await service.observe([{
        ruleId: "runtime-ignore", subject: root, producer: "sweep", owner: "sweep",
        repository: store.identity, revision: "one", outcome: "finding", evidence: "Managed by Sweep", checkedAt: new Date().toISOString()
    }]);
    await expect(service.repair("runtime-ignore", root)).rejects.toThrow(/permitted/);
});

it("refuses repairs during active Git operations and preserves the ignore file", async () => {
    const { service, root, store } = await fixture();
    await writeFile(path.join(root, ".gitignore"), "*.log\n");
    await writeFile(path.join(root, ".git", "MERGE_HEAD"), "active");
    await service.observe([{ ruleId: "runtime-ignore", subject: root, producer: "test", owner: "compliance",
        repository: store.identity, revision: "one", outcome: "finding", evidence: "Missing rule", checkedAt: new Date().toISOString() }]);
    const result = await service.repair("runtime-ignore", root);
    expect(result.observations[0]?.repairAdvice).toContain("Git operation");
    expect(result.observations[0]?.finding).toBeDefined();
    expect(await readFile(path.join(root, ".gitignore"), "utf8")).toBe("*.log\n");
});

it("initialization repairs only the ignore rule even with background monitoring disabled", async () => {
    const { service, root } = await fixture();
    await service.initialize();
    expect(await readFile(path.join(root, ".gitignore"), "utf8")).toBe("/.openspec-ui/\n");
    expect((await service.read()).policy.backgroundEnabled).toBe(false);
    expect((await service.read()).observations[0]?.outcome).toBe("pass");
});

it("preserves equivalent semantic ignores and appends after a directory negation", async () => {
    const { root, store } = await fixture();
    await promisify(execFile)("git", ["init", root], { windowsHide: true, timeout: 3_000 });
    const service = new ComplianceService(root, store);
    const file = path.join(root, ".gitignore");
    const equivalent = "**/.openspec-ui/\r\n";
    await writeFile(file, equivalent);
    await service.initialize();
    expect(await readFile(file, "utf8")).toBe(equivalent);
    const negation = "*.log\n!/.openspec-ui/\n";
    await writeFile(file, negation);
    await service.initialize();
    expect(await readFile(file, "utf8")).toBe(`${negation}/.openspec-ui/\n`);
});

it("preserves foreign ignore-file bytes when no safe repair is possible", async () => {
    const { service, root, store } = await fixture();
    const bytes = Buffer.from([0, 255, 10]);
    await writeFile(path.join(root, ".gitignore"), bytes);
    await service.observe([{ ruleId: "runtime-ignore", subject: root, producer: "test", owner: "compliance",
        repository: store.identity, revision: "one", outcome: "finding", evidence: "Missing rule", checkedAt: new Date().toISOString() }]);
    const result = await service.repair("runtime-ignore", root);
    expect(result.observations[0]?.repairAdvice).toContain("encoding");
    expect((await new ComplianceService(root, store).read()).observations[0]?.repairAdvice).toContain("manually");
    expect(await readFile(path.join(root, ".gitignore"))).toEqual(bytes);
});

it("reports untracked main shadow files without moving or deleting them", async () => {
    const { root, store } = await fixture();
    await promisify(execFile)("git", ["init", root], { windowsHide: true, timeout: 3_000 });
    const service = new ComplianceService(root, store);
    const file = path.join(root, "openspec", "changes", "demo", "harness.json");
    await writeFile(file, "fixture-content");
    await service.observe([{ ruleId: "worktree-state", subject: "owner", worktree: path.join(root, "owner"), change: "demo",
        producer: "survey", owner: "compliance", repository: store.identity, revision: "one", outcome: "pass", evidence: "Owner", checkedAt: new Date().toISOString() }]);
    const initial = await service.read();
    await service.savePolicy({ ...initial.policy, global: { enabled: false }, rules: { "change-shadow": { enabled: true } } }, initial.generation);
    const reading = await service.readRemainingStep(true, false);
    const shadow = reading.observations.find(item => item.ruleId === "change-shadow");
    expect(shadow?.outcome).toBe("finding");
    expect(shadow?.evidence).toContain("harness.json");
    expect(await readFile(file, "utf8")).toBe("fixture-content");
});

it("repairs in background only when tracking and autorepair are explicitly enabled", async () => {
    const { root, service } = await fixture();
    const initial = await service.read();
    await service.savePolicy({ ...initial.policy, backgroundEnabled: true, global: { enabled: false },
        rules: { "runtime-ignore": { enabled: true, reaction: "autorepair" } } }, initial.generation);
    await service.readRemainingStep(false, true);
    expect(await readFile(path.join(root, ".gitignore"), "utf8")).toBe("/.openspec-ui/\n");
    expect((await service.read()).observations.find(item => item.ruleId === "runtime-ignore")?.outcome).toBe("pass");
});

it("reports unknown when Git cannot verify ignores and never guesses a repair", async () => {
    const { root, store } = await fixture();
    await writeFile(path.join(root, ".gitignore"), "*.log\n");
    const service = new ComplianceService(root, store, async () => { throw new Error("Git unavailable"); });
    await service.initialize();
    expect((await service.read()).observations[0]?.outcome).toBe("unknown");
    expect(await readFile(path.join(root, ".gitignore"), "utf8")).toBe("*.log\n");
});

it("falls back from background autorepair to advice without changing policy or files", async () => {
    const { root, service } = await fixture();
    const bytes = Buffer.from([0, 255, 10]);
    await writeFile(path.join(root, ".gitignore"), bytes);
    const initial = await service.read();
    await service.savePolicy({ ...initial.policy, backgroundEnabled: true, global: { enabled: false },
        rules: { "runtime-ignore": { enabled: true, reaction: "autorepair" } } }, initial.generation);
    const result = await service.readRemainingStep(false, true);
    const item = result.observations.find(item => item.ruleId === "runtime-ignore");
    expect(item?.repairAdvice).toContain("encoding");
    expect(item?.finding).toBeDefined();
    expect(result.policy.rules["runtime-ignore"]?.reaction).toBe("autorepair");
    expect(await readFile(path.join(root, ".gitignore"))).toEqual(bytes);
    expect((await service.readRemainingStep(false, true)).observations).toEqual(result.observations);
});

it("does not disguise post-write verification failure as an unsafe no-write skip", async () => {
    const { root, store } = await fixture();
    const service = new ComplianceService(root, store, async () => false);
    await service.observe([{ ruleId: "runtime-ignore", subject: root, producer: "test", owner: "compliance",
        repository: store.identity, revision: "one", outcome: "finding", evidence: "Missing rule", checkedAt: new Date().toISOString() }]);
    await expect(service.repair("runtime-ignore", root)).rejects.toThrow(/appended but Git still/);
    expect(await readFile(path.join(root, ".gitignore"), "utf8")).toBe("/.openspec-ui/\n");
    const reading = await service.read();
    expect(reading.observations[0]?.repairAdvice).toBeUndefined();
    expect(reading.observations[0]?.finding).toBeDefined();
});

it("falls back to advice while another host holds the repair lock", async () => {
    const { root, service, store } = await fixture();
    await service.observe([{ ruleId: "runtime-ignore", subject: root, producer: "test", owner: "compliance",
        repository: store.identity, revision: "one", outcome: "finding", evidence: "Missing rule", checkedAt: new Date().toISOString() }]);
    await writeFile(`${store.filePath}.repair`, "another-host");
    const reading = await service.repair("runtime-ignore", root);
    expect(reading.observations[0]?.repairAdvice).toContain("Another host");
    expect(await readFile(`${store.filePath}.repair`, "utf8")).toBe("another-host");
    expect(await readFile(path.join(root, ".gitignore"), "utf8").catch(() => "absent")).toBe("absent");
});