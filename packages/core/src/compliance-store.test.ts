import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { ComplianceCache } from "./compliance.js";
import { ComplianceStore, complianceRepositoryIdentity, validateCompliancePolicy } from "./compliance-store.js";

vi.setConfig({ testTimeout: 10_000 });
const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function fixture() {
    const root = await mkdtemp(path.join(os.tmpdir(), "compliance-store-"));
    directories.push(root);
    return root;
}

it("shares identity across sibling worktrees without invoking Git", async () => {
    const root = await fixture();
    const main = path.join(root, "main");
    const work = path.join(root, "work");
    await mkdir(path.join(main, ".git", "worktrees", "work"), { recursive: true });
    await mkdir(work);
    await writeFile(path.join(work, ".git"), `gitdir: ${path.join(main, ".git", "worktrees", "work")}`);
    await writeFile(path.join(main, ".git", "worktrees", "work", "commondir"), "../..");
    expect(await complianceRepositoryIdentity(work)).toBe(await complianceRepositoryIdentity(main));
});

it("merges observations atomically and preserves unknown findings and change time", async () => {
    const root = await fixture();
    const store = new ComplianceStore("repo", root);
    const cache = new ComplianceCache();
    cache.record({
        ruleId: "runtime-ignore", subject: "main", producer: "test", owner: "compliance",
        repository: "repo", revision: "one", outcome: "finding", evidence: "Missing rule", checkedAt: "2026-10-11T10:00:00Z", durationSamplesMs: [20, 40]
    });
    await store.update(cache.snapshot());
    cache.record({ ...cache.snapshot()[0]!, outcome: "unknown", evidence: "Unreadable", checkedAt: "2026-10-11T10:01:00Z" });
    await store.update(cache.snapshot());
    const restored = await store.read();
    expect(restored.observations[0]!.finding?.evidence).toBe("Missing rule");
    expect(restored.observations[0]!.checkedAt).toBe("2026-10-11T10:01:00.000Z");
    expect(restored.observations[0]!.durationSamplesMs).toEqual([20, 40]);
    await store.update([]);
    expect((await store.read()).observations).toEqual(restored.observations);
});

it("refuses concurrent writers and stale settings rather than overwriting", async () => {
    const root = await fixture();
    const store = new ComplianceStore("repo", root);
    const initial = await store.read();
    await writeFile(`${store.filePath}.lock`, "held");
    await expect(store.update([])).rejects.toThrow(/another host/);
    await rm(`${store.filePath}.lock`);
    await store.update([], { ...initial.policy, backgroundEnabled: true }, 0);
    await expect(store.update([], initial.policy, 0)).rejects.toThrow(/reload/);
    expect((await store.read()).policy.backgroundEnabled).toBe(true);
});

it("fails closed on malformed state and rejects unknown settings", async () => {
    const root = await fixture();
    const store = new ComplianceStore("repo", root);
    await writeFile(store.filePath, "not json");
    await expect(store.update([])).rejects.toThrow();
    expect(() => validateCompliancePolicy({ backgroundEnabled: true, global: { reaction: "execute" }, topics: {}, rules: {} })).toThrow();
});