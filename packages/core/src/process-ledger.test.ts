import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    commandLineHash, ProcessLedger, terminateLedgerProcess, verifyProcessSnapshot,
    type ProcessSnapshot,
} from "./process-ledger.js";
import { COMPLIANCE_RULES, complianceProcessObservations, processExpectedDurationMs } from "./compliance-service.js";
import { effectiveComplianceSetting, type CompliancePolicy } from "./compliance.js";

vi.setConfig({ testTimeout: 10_000 });
const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function fixture() {
    const root = await mkdtemp(path.join(os.tmpdir(), "process-ledger-"));
    directories.push(root);
    return new ProcessLedger(path.join(root, "ledger"));
}

function snapshot(over: Partial<ProcessSnapshot> = {}): ProcessSnapshot {
    return {
        runId: "run-1", pid: 4242, executablePath: "/usr/bin/claude", hostname: "box",
        cwd: "/repo", commandLineHash: commandLineHash("claude", ["-p"]),
        spawnedAt: "2026-10-11T10:00:00.000Z", startTime: "2026-10-11T09:59:59.000Z",
        ...over,
    };
}

describe("commandLineHash", () => {
    it("is deterministic and depends on arguments without storing them", () => {
        const first = commandLineHash("claude", ["-p", "secret"]);
        const second = commandLineHash("claude", ["-p", "secret"]);
        const different = commandLineHash("claude", ["-p", "other"]);
        expect(first).toBe(second);
        expect(first).not.toBe(different);
        expect(first).toMatch(/^[0-9a-f]{64}$/u);
        expect(first).not.toContain("secret");
    });
});

describe("ProcessLedger", () => {
    it("records a snapshot synchronously and returns it in list", async () => {
        const ledger = await fixture();
        ledger.record(snapshot());
        const listed = ledger.list();
        expect(listed).toHaveLength(1);
        expect(listed[0]).toMatchObject({ runId: "run-1", pid: 4242, executablePath: "/usr/bin/claude" });
        // The raw command line is never written.
        const raw = await readFile(path.join(ledger.directory, "run-1-4242.json"), "utf8");
        expect(raw).not.toContain("secret");
    });

    it("adds start time and exit time to the same record", async () => {
        const ledger = await fixture();
        ledger.record(snapshot({ startTime: undefined }));
        ledger.setStartTime("run-1", 4242, "2026-10-11T09:59:59.000Z");
        ledger.markExited("run-1", 4242, "2026-10-11T10:05:00.000Z");
        expect(ledger.list()[0]).toMatchObject({
            startTime: "2026-10-11T09:59:59.000Z",
            exitedAt: "2026-10-11T10:05:00.000Z",
        });
    });

    it("ignores a corrupt record instead of failing the list", async () => {
        const ledger = await fixture();
        ledger.record(snapshot());
        await rm(path.join(ledger.directory, "run-1-4242.json"));
        ledger.record(snapshot({ runId: "run-2", pid: 7 }));
        expect(ledger.list().map((entry) => entry.runId)).toEqual(["run-2"]);
    });
});

describe("verifyProcessSnapshot", () => {
    const readStart = vi.fn<(pid: number) => Promise<Date | undefined>>();

    it("matches when hostname and start time agree", async () => {
        readStart.mockResolvedValue(new Date("2026-10-11T09:59:59.000Z"));
        await expect(verifyProcessSnapshot(4242, snapshot(), "box", readStart)).resolves.toEqual({ matches: true });
    });

    it("refuses a PID whose live start time differs", async () => {
        readStart.mockResolvedValue(new Date("2026-10-11T12:00:00.000Z"));
        const result = await verifyProcessSnapshot(4242, snapshot(), "box", readStart);
        expect(result.matches).toBe(false);
        expect(result.reason).toContain("PID reuse");
    });

    it("refuses when start time is unavailable or never recorded", async () => {
        readStart.mockResolvedValue(undefined);
        expect((await verifyProcessSnapshot(4242, snapshot(), "box", readStart)).matches).toBe(false);
        readStart.mockResolvedValue(new Date("2026-10-11T09:59:59.000Z"));
        expect((await verifyProcessSnapshot(4242, snapshot({ startTime: undefined }), "box", readStart)).matches).toBe(false);
    });

    it("refuses a snapshot recorded on another host", async () => {
        const result = await verifyProcessSnapshot(4242, snapshot({ hostname: "other" }), "box", readStart);
        expect(result.matches).toBe(false);
        expect(result.reason).toContain("other");
    });
});

describe("terminateLedgerProcess", () => {
    it("does not call the terminator when the snapshot no longer matches", async () => {
        const terminate = vi.fn(async () => ({ attempted: true }));
        const readStart = vi.fn(async () => new Date("2026-10-11T12:00:00.000Z"));
        const result = await terminateLedgerProcess(4242, snapshot(), terminate, { hostname: "box", readStart });
        expect(result.terminated).toBe(false);
        expect(terminate).not.toHaveBeenCalled();
    });

    it("terminates the tree only after a successful re-verification", async () => {
        const terminate = vi.fn(async () => ({ attempted: true }));
        const readStart = vi.fn(async () => new Date("2026-10-11T09:59:59.000Z"));
        const result = await terminateLedgerProcess(4242, snapshot(), terminate, { hostname: "box", readStart });
        expect(result.terminated).toBe(true);
        expect(terminate).toHaveBeenCalledWith(4242);
    });
});

describe("process rules are read-only in Compliance", () => {
    it("resolves autorepair to advice because no process rule has a repair", () => {
        const policy: CompliancePolicy = { backgroundEnabled: false, global: { reaction: "autorepair" }, topics: {}, rules: {} };
        for (const rule of COMPLIANCE_RULES.filter((candidate) => candidate.id === "process-overdue" || candidate.id === "process-orphan")) {
            expect(rule.repair).toBeUndefined();
            expect(effectiveComplianceSetting(policy, rule).reaction).toBe("advice");
        }
    });
});

describe("process compliance observations", () => {
    it("maps known tool subprocesses to a short default and agents to unknown", () => {
        expect(processExpectedDurationMs("git")).toEqual({ known: true, ms: 5 * 60_000 });
        expect(processExpectedDurationMs("claude").known).toBe(false);
    });

    it("reports orphaned, overdue and unknown-limit processes without terminating", () => {
        const now = Date.now();
        const hostStarted = now - 30 * 60_000;
        const observations = complianceProcessObservations("repo", [
            snapshot({ runId: "orphan", pid: 1, spawnedAt: new Date(now - 40 * 60_000).toISOString(), executablePath: "claude" }),
            snapshot({ runId: "late", pid: 2, spawnedAt: new Date(now - 10 * 60_000).toISOString(), executablePath: "git" }),
            snapshot({ runId: "agent", pid: 3, spawnedAt: new Date(now - 1_000).toISOString(), executablePath: "claude" }),
            snapshot({ runId: "done", pid: 4, spawnedAt: new Date(now - 1_000).toISOString(), executablePath: "git", exitedAt: new Date().toISOString() }),
        ], new Date(now).toISOString(), hostStarted);

        const orphan = observations.find((o) => o.ruleId === "process-orphan");
        const overdue = observations.find((o) => o.ruleId === "process-overdue" && o.outcome === "finding");
        const unknown = observations.find((o) => o.ruleId === "process-overdue" && o.outcome === "unknown");
        expect(orphan?.subject).toBe("orphan:1");
        expect(overdue?.subject).toBe("late:2");
        expect(unknown?.subject).toBe("agent:3");
        expect(observations.some((o) => o.subject === "done:4")).toBe(false);
    });
});
