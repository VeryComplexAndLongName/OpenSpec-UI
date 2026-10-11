import { describe, expect, it, vi } from "vitest";
import {
    ComplianceCache, ComplianceReader, effectiveComplianceSetting, nextComplianceStep,
    type ComplianceObservation, type CompliancePolicy, type ComplianceRule,
    type ComplianceWorkWindow,
} from "./compliance.js";

const rule: ComplianceRule = {
    id: "runtime-ignore", topic: "runtime", title: "Runtime state is ignored",
    source: "repository-compliance", severity: "warning", conservativeMs: 20,
    repair: "append-runtime-ignore",
};
const policy: CompliancePolicy = {
    backgroundEnabled: false, global: {}, topics: {}, rules: {},
};
const observation: ComplianceObservation = {
    ruleId: rule.id, subject: "main", producer: "initialization", owner: "compliance",
    repository: "repo", revision: "one", outcome: "finding", evidence: "Missing ignore rule",
    checkedAt: "2026-10-11T10:00:00.000Z", path: "/repo/.gitignore",
};
const window: ComplianceWorkWindow = {
    explicit: false, idle: true, mutationActive: false, checkActive: false,
    cancelled: false, nowMs: 100, remainingMs: 50, nextAllowedAtMs: 0,
};

describe("ComplianceCache", () => {
    it("reads detached snapshots without starting work and notifies only on updates", () => {
        const cache = new ComplianceCache();
        const listener = vi.fn();
        const unsubscribe = cache.subscribe(listener);
        cache.record(observation);
        const reading = cache.snapshot();
        reading[0]!.evidence = "Changed by viewer";
        expect(cache.snapshot()[0]!.evidence).toBe(observation.evidence);
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
        cache.record({ ...observation, checkedAt: "2026-10-11T10:01:00.000Z" });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("advances checked time but not changed time for the same finding", () => {
        const cache = new ComplianceCache();
        cache.record(observation);
        cache.record({ ...observation, revision: "two", checkedAt: "2026-10-11T10:01:00.000Z" });
        expect(cache.snapshot()[0]).toMatchObject({
            checkedAt: "2026-10-11T10:01:00.000Z", changedAt: observation.checkedAt,
        });
    });

    it("retains known findings on unknown and removes them only on a newer pass", () => {
        const cache = new ComplianceCache();
        cache.record(observation);
        cache.record({
            ...observation, outcome: "unknown", evidence: "Unreadable",
            checkedAt: "2026-10-11T10:01:00.000Z"
        });
        expect(cache.snapshot()[0]!.finding?.evidence).toBe(observation.evidence);
        expect(cache.record({ ...observation, outcome: "pass" })).toBe(false);
        expect(cache.snapshot()[0]!.finding).toBeDefined();
        cache.record({
            ...observation, outcome: "pass", evidence: "Ignored",
            checkedAt: "2026-10-11T10:02:00.000Z"
        });
        expect(cache.snapshot()[0]!.finding).toBeUndefined();
    });

    it("separates repositories and subjects and bounds cache size", () => {
        const cache = new ComplianceCache(2);
        cache.record(observation);
        cache.record({ ...observation, repository: "other" });
        cache.record({ ...observation, subject: "worktree" });
        expect(cache.snapshot().map(item => [item.repository, item.subject]))
            .toEqual([["other", "main"], ["repo", "worktree"]]);
    });

    it("rejects oversized evidence and invalid timestamps", () => {
        const cache = new ComplianceCache();
        expect(() => cache.record({ ...observation, evidence: "x".repeat(2_049) })).toThrow();
        expect(() => cache.record({ ...observation, checkedAt: "invalid" })).toThrow();
        expect(cache.snapshot()).toEqual([]);
    });
});

describe("Compliance policy", () => {
    it("inherits tracking and reaction independently with visible sources", () => {
        expect(effectiveComplianceSetting({
            ...policy,
            global: { enabled: false, reaction: "none" },
            topics: { runtime: { reaction: "advice" } },
            rules: { [rule.id]: { enabled: true } },
        }, rule)).toMatchObject({
            enabled: true, reaction: "advice",
            enabledFrom: "rule", reactionFrom: "topic", repair: rule.repair
        });
    });

    it("never grants repair authority for Sweep or an unsupported repair", () => {
        const automatic = { ...policy, global: { reaction: "autorepair" as const } };
        expect(effectiveComplianceSetting(automatic, rule, "sweep"))
            .toMatchObject({ reaction: "advice" });
        expect(effectiveComplianceSetting(automatic, rule, "sweep").repair).toBeUndefined();
        expect(effectiveComplianceSetting(automatic, { ...rule, repair: undefined }).reaction)
            .toBe("advice");
    });
});

describe("Compliance step planner", () => {
    const steps = [{ rule, subject: "main", dueAtMs: 0 }];
    const background = { ...policy, backgroundEnabled: true };

    it("starts no work by default and selects only one step when allowed", () => {
        expect(nextComplianceStep(steps, policy, window)).toBeUndefined();
        expect(nextComplianceStep(steps, background, window)).toEqual(steps[0]);
    });

    it.each(["mutationActive", "checkActive", "cancelled"] as const)("honors %s even for explicit reads", key => {
        expect(nextComplianceStep(steps, policy, { ...window, explicit: true, [key]: true }))
            .toBeUndefined();
    });

    it("requires background idle, but never removes budget or gap limits for explicit reads", () => {
        expect(nextComplianceStep(steps, background, { ...window, idle: false })).toBeUndefined();
        expect(nextComplianceStep(steps, policy, { ...window, idle: false, explicit: true })).toBeDefined();
        expect(nextComplianceStep(steps, policy, { ...window, explicit: true, remainingMs: 19 })).toBeUndefined();
        expect(nextComplianceStep(steps, policy, { ...window, explicit: true, nextAllowedAtMs: 101 })).toBeUndefined();
    });

    it("respects measured cost, retry backoff and disabled tracking but not muted presentation", () => {
        expect(nextComplianceStep([{ ...steps[0]!, measuredP95Ms: 60 }], background, window)).toBeUndefined();
        expect(nextComplianceStep([{ ...steps[0]!, retryAfterMs: 101 }], background, window)).toBeUndefined();
        expect(nextComplianceStep(steps, { ...background, global: { enabled: false } }, window)).toBeUndefined();
        expect(nextComplianceStep(steps, { ...background, global: { reaction: "none" } }, window)).toBeDefined();
    });
});

describe("ComplianceReader", () => {
    const explicit = { explicit: true, idle: false, mutationActive: false, remainingMs: 50 };

    it("runs one check, leaves repairs alone and yields even for explicit completion", async () => {
        let clock = 0;
        const cache = new ComplianceCache();
        const reader = new ComplianceReader(cache, () => clock);
        const check = vi.fn(async () => { clock += 25; return observation; });
        const steps = [{ rule, subject: "main", dueAtMs: 0, check }];
        expect(await reader.readOne(steps, { ...policy, global: { reaction: "autorepair" } }, explicit))
            .toMatchObject({ state: "checked", elapsedMs: 25, nextAllowedAtMs: 5_025 });
        expect(await reader.readOne(steps, policy, explicit)).toMatchObject({ state: "deferred" });
        expect(check).toHaveBeenCalledTimes(1);
        expect(cache.snapshot()[0]!.outcome).toBe("finding");
    });

    it("refuses overlapping checks and cancelled reads without timers or sleeping", async () => {
        let finish: (value: ComplianceObservation) => void = () => { };
        const check = vi.fn(() => new Promise<ComplianceObservation>(resolve => { finish = resolve; }));
        const steps = [{ rule, subject: "main", dueAtMs: 0, check }];
        const reader = new ComplianceReader(new ComplianceCache(), () => 0);
        const first = reader.readOne(steps, policy, explicit);
        expect(await reader.readOne(steps, policy, explicit)).toMatchObject({ state: "deferred" });
        finish(observation);
        await first;
        const cancelled = new AbortController();
        cancelled.abort();
        expect(await reader.readOne(steps, policy, explicit, cancelled.signal)).toMatchObject({ state: "deferred" });
        expect(check).toHaveBeenCalledTimes(1);
    });

    it("backs off failed checks and keeps the known finding", async () => {
        let clock = 0;
        const cache = new ComplianceCache();
        cache.record(observation);
        const reader = new ComplianceReader(cache, () => clock);
        const check = vi.fn(async (): Promise<ComplianceObservation> => { throw new Error("Cannot read"); });
        const steps = [{ rule, subject: "main", dueAtMs: 0, check }];
        expect(await reader.readOne(steps, policy, explicit)).toMatchObject({ state: "failed", nextAllowedAtMs: 10_000 });
        clock = 5_000;
        expect(await reader.readOne(steps, policy, explicit)).toMatchObject({ state: "deferred" });
        clock = 10_000;
        expect(await reader.readOne(steps, policy, explicit)).toMatchObject({ state: "failed", nextAllowedAtMs: 30_000 });
        expect(cache.snapshot()[0]!.finding).toBeDefined();
        expect(check).toHaveBeenCalledTimes(2);
    });

    it("uses measured cost to defer a slow check and never repairs during reads", async () => {
        let clock = 0;
        const reader = new ComplianceReader(new ComplianceCache(), () => clock);
        const check = vi.fn(async () => { clock += 60; return observation; });
        const steps = [{ rule, subject: "main", dueAtMs: 0, check }];
        await reader.readOne(steps, policy, explicit);
        clock = 6_000;
        expect(await reader.readOne(steps, policy, explicit)).toMatchObject({ state: "deferred" });
        expect(check).toHaveBeenCalledTimes(1);
    });
});