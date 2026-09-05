import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureCheckpoint, deserializeCheckpoint, finalizeCheckpoint, rollbackCheckpoint, serializeCheckpoint } from "./checkpoint.js";
import {
    WorkbenchJournalLoadError,
    WorkbenchRunJournal,
} from "./workbench-run-journal.js";

// suite-survives-a-loaded-machine:
// measured 2026-09-05 for this file alone at 1.52s test time (4.74s wall)
// and 6.23s test time (18.04s wall) under deliberate 8-worker CPU co-load.
vi.setConfig({ testTimeout: 40000 });

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-journal-"));
    roots.push(root);
    return root;
}

function checkpointFilePath(root: string, processId: string): string {
    return path.join(root, ".openspec-ui", "checkpoints", `${processId}.json`);
}

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("WorkbenchRunJournal", () => {
    it("round-trips process and checkpoint state", async () => {
        const root = await temporaryRoot();
        await writeFile(path.join(root, "tracked.txt"), "before");
        const checkpoint = await captureCheckpoint(root);
        const journal = new WorkbenchRunJournal(root);
        await journal.save({
            processes: [{
                id: "run-1",
                operation: "implement",
                changeName: "demo",
                mutating: true,
                state: "running",
                createdAt: "2026-08-08T10:00:00.000Z",
            }],
            checkpointSessions: [{
                processId: "run-1",
                changeName: "demo",
                checkpoint: serializeCheckpoint(checkpoint),
            }],
        });

        const restored = await journal.load();
        expect(restored.processes).toHaveLength(1);
        expect((await restored.checkpointSessions[0]!.loadCheckpoint())!.checkpoint.before[0]!.path).toBe("tracked.txt");
        expect(restored.checkpointSessions[0]!.changeName).toBe("demo");
    });

    it("round-trips a suspended process and its wait reason (harness-suspendable-stage task 4.1)", async () => {
        const root = await temporaryRoot();
        const journal = new WorkbenchRunJournal(root);
        await journal.save({
            processes: [{
                id: "run-1",
                operation: "implement",
                changeName: "demo",
                mutating: true,
                state: "suspended",
                waitingFor: "a CI run to finish",
                createdAt: "2026-08-08T10:00:00.000Z",
            }],
            checkpointSessions: [],
        });

        const restored = await journal.load();

        expect(restored.processes).toEqual([expect.objectContaining({
            id: "run-1",
            state: "suspended",
            waitingFor: "a CI run to finish",
        })]);
    });

    it("does not rewrite a finalized checkpoint file when only process state changes", async () => {
        const root = await temporaryRoot();
        await writeFile(path.join(root, "large.bin"), Buffer.alloc(200_000, "a"));
        const checkpoint = serializeCheckpoint(await captureCheckpoint(root));
        const journal = new WorkbenchRunJournal(root);
        const session = { processId: "run-1", changeName: "demo", checkpoint };

        await journal.save({
            processes: [{
                id: "run-1", operation: "implement", changeName: "demo", mutating: true,
                state: "running", createdAt: "2026-08-08T10:00:00.000Z",
            }],
            checkpointSessions: [session],
        });
        const checkpointPath = checkpointFilePath(root, "run-1");
        const before = await stat(checkpointPath);
        expect(before.size).toBeGreaterThan(200_000);

        await journal.save({
            processes: [{
                id: "run-1", operation: "implement", changeName: "demo", mutating: true,
                state: "completed", createdAt: "2026-08-08T10:00:00.000Z",
            }],
            checkpointSessions: [session],
        });

        const after = await stat(checkpointPath);
        expect(after.mtimeMs).toBe(before.mtimeMs);
        expect(after.size).toBe(before.size);

        const journalContent = await readFile(journal.filePath, "utf8");
        expect(journalContent.length).toBeLessThan(before.size / 10);
        expect(journalContent).not.toContain("large.bin");
    });

    it("migrates a version-1 journal into per-session checkpoint files under version 3", async () => {
        const root = await temporaryRoot();
        await writeFile(path.join(root, "tracked.txt"), "before");
        const checkpoint = await captureCheckpoint(root);
        const serialized = serializeCheckpoint(checkpoint);
        const journal = new WorkbenchRunJournal(root);
        const v1Document = {
            version: 1,
            processes: [{
                id: "run-1", operation: "implement", changeName: "demo", mutating: true,
                state: "completed", createdAt: "2026-08-08T10:00:00.000Z",
            }],
            checkpointSessions: [{ processId: "run-1", changeName: "demo", checkpoint: serialized }],
        };
        await mkdir(path.dirname(journal.filePath), { recursive: true });
        await writeFile(journal.filePath, JSON.stringify(v1Document, null, 2), "utf8");

        const restored = await journal.load();
        expect(restored.processes).toHaveLength(1);
        expect((await restored.checkpointSessions[0]!.loadCheckpoint())!.checkpoint.before[0]!.path).toBe("tracked.txt");
        expect(restored.checkpointSessions[0]!.changeName).toBe("demo");

        const rewritten = JSON.parse(await readFile(journal.filePath, "utf8")) as {
            version: number;
            checkpointSessions: Array<{ processId: string; changeName?: string; hasAfter?: boolean }>;
        };
        expect(rewritten.version).toBe(3);
        expect(rewritten.checkpointSessions).toEqual([
            expect.objectContaining({ processId: "run-1", changeName: "demo", hasAfter: false }),
        ]);

        const checkpointFileContent = JSON.parse(
            await readFile(checkpointFilePath(root, "run-1"), "utf8"),
        ) as { id: string };
        expect(checkpointFileContent.id).toBe(serialized.id);
    });

    it("migrates a version-2 journal to version 3 without dropping checkpoint readability", async () => {
        const root = await temporaryRoot();
        await writeFile(path.join(root, "tracked.txt"), "before");
        const checkpoint = await captureCheckpoint(root);
        await finalizeCheckpoint(checkpoint);
        const serialized = serializeCheckpoint(checkpoint);
        const journal = new WorkbenchRunJournal(root);
        await journal.save({
            processes: [{
                id: "run-2",
                operation: "implement",
                changeName: "demo",
                mutating: true,
                state: "completed",
                createdAt: "2026-08-08T10:00:00.000Z",
            }],
            checkpointSessions: [{ processId: "run-2", changeName: "demo", checkpoint: serialized }],
        });

        const v2Document = {
            version: 2,
            processes: [{
                id: "run-2",
                operation: "implement",
                changeName: "demo",
                mutating: true,
                state: "completed",
                createdAt: "2026-08-08T10:00:00.000Z",
            }],
            checkpointSessions: [{ processId: "run-2", changeName: "demo" }],
        };
        await writeFile(journal.filePath, JSON.stringify(v2Document, null, 2), "utf8");

        const restored = await journal.load();
        expect(restored.processes).toHaveLength(1);
        const resolved = await restored.checkpointSessions[0]!.loadCheckpoint();
        expect(resolved).toBeDefined();
        expect(resolved!.checkpoint.id).toBe(serialized.id);

        const rewritten = JSON.parse(await readFile(journal.filePath, "utf8")) as {
            version: number;
            checkpointSessions: Array<{ processId: string; changeName?: string }>;
        };
        expect(rewritten.version).toBe(3);
        expect(rewritten.checkpointSessions).toEqual([
            expect.objectContaining({ processId: "run-2", changeName: "demo" }),
        ]);
    });

    it("loads successfully and reports no checkpoint when a referenced session's file is missing", async () => {
        const root = await temporaryRoot();
        const checkpoint = serializeCheckpoint(await captureCheckpoint(root));
        const journal = new WorkbenchRunJournal(root);
        await journal.save({
            processes: [{
                id: "run-1", operation: "implement", mutating: true,
                state: "completed", createdAt: "2026-08-08T10:00:00.000Z",
            }],
            checkpointSessions: [{ processId: "run-1", checkpoint }],
        });
        await rm(checkpointFilePath(root, "run-1"));

        const restored = await journal.load();
        expect(restored.processes).toHaveLength(1);
        // The reference survives; only its content is gone. `load()` no
        // longer reads payloads, so "no checkpoint" is now what
        // `loadCheckpoint()` answers rather than something `load()` can
        // know — and a run whose content was evicted still lists.
        expect(restored.checkpointSessions.map((session) => session.processId)).toEqual(["run-1"]);
        expect(await restored.checkpointSessions[0]!.loadCheckpoint()).toBeUndefined();
    });

    it("removes a checkpoint file that no journal entry references", async () => {
        const root = await temporaryRoot();
        const journal = new WorkbenchRunJournal(root);
        await journal.save({ processes: [], checkpointSessions: [] });
        const orphanPath = checkpointFilePath(root, "orphan");
        await mkdir(path.dirname(orphanPath), { recursive: true });
        await writeFile(orphanPath, "{}", "utf8");

        await journal.load();

        await expect(stat(orphanPath)).rejects.toThrow();
    });

    it("deletes a pruned process's checkpoint file when retention drops it", async () => {
        const root = await temporaryRoot();
        const checkpoint = serializeCheckpoint(await captureCheckpoint(root));
        const data = {
            processes: [
                { id: "old", operation: "status", mutating: false, state: "completed" as const, createdAt: "2026-08-07T10:00:00.000Z" },
                { id: "new", operation: "implement", mutating: true, state: "completed" as const, createdAt: "2026-08-08T10:00:00.000Z" },
            ],
            checkpointSessions: [
                { processId: "old", checkpoint },
                { processId: "new", checkpoint },
            ],
        };
        await new WorkbenchRunJournal(root, { maxProcesses: 2 }).save(data);
        const oldCheckpointPath = checkpointFilePath(root, "old");
        await expect(stat(oldCheckpointPath)).resolves.toBeTruthy();

        await new WorkbenchRunJournal(root, { maxProcesses: 1 }).save(data);

        await expect(stat(oldCheckpointPath)).rejects.toThrow();
        const restored = await new WorkbenchRunJournal(root).load();
        expect(restored.processes.map((process) => process.id)).toEqual(["new"]);
        expect(restored.checkpointSessions.map((session) => session.processId)).toEqual(["new"]);
    });

    it("load() performs no checkpoint payload reads (tasks 2.1/4.1)", async () => {
        const root = await temporaryRoot();
        const checkpoint = serializeCheckpoint(await captureCheckpoint(root));
        const journal = new WorkbenchRunJournal(root);
        await journal.save({
            processes: [
                { id: "run-1", operation: "implement", mutating: true, state: "completed", createdAt: "2026-08-08T10:00:00.000Z" },
                { id: "run-2", operation: "implement", mutating: true, state: "completed", createdAt: "2026-08-08T11:00:00.000Z" },
            ],
            checkpointSessions: [
                { processId: "run-1", checkpoint },
                { processId: "run-2", checkpoint },
            ],
        });
        // Corrupt both checkpoint files after saving. If `load()` read
        // either payload, `JSON.parse` on this content would throw and
        // fail the test; a passing `load()` here is proof it never opened
        // them, not just a fast one.
        await writeFile(checkpointFilePath(root, "run-1"), "not valid json {{{", "utf8");
        await writeFile(checkpointFilePath(root, "run-2"), "not valid json {{{", "utf8");

        const restored = await journal.load();

        expect(restored.processes).toHaveLength(2);
        expect(restored.checkpointSessions.map((session) => session.processId).sort()).toEqual(["run-1", "run-2"]);
        // Only reading the payload now (via loadCheckpoint()) hits the
        // corrupt content, and it degrades to "no checkpoint" rather than
        // throwing, per the existing missing/invalid-file behavior.
        for (const session of restored.checkpointSessions) {
            await expect(session.loadCheckpoint()).resolves.toBeUndefined();
        }
    });

    it("retains only the newest maxCheckpointSessions and deletes the evicted files (tasks 1.2/4.2)", async () => {
        const root = await temporaryRoot();
        const checkpoint = serializeCheckpoint(await captureCheckpoint(root));
        const journal = new WorkbenchRunJournal(root, { maxProcesses: 100, maxCheckpointSessions: 2 });
        const data = {
            processes: [
                { id: "oldest", operation: "status", mutating: false, state: "completed" as const, createdAt: "2026-08-01T10:00:00.000Z" },
                { id: "middle", operation: "status", mutating: false, state: "completed" as const, createdAt: "2026-08-02T10:00:00.000Z" },
                { id: "newest", operation: "status", mutating: false, state: "completed" as const, createdAt: "2026-08-03T10:00:00.000Z" },
            ],
            checkpointSessions: [
                { processId: "oldest", checkpoint },
                { processId: "middle", checkpoint },
                { processId: "newest", checkpoint },
            ],
        };

        await journal.save(data);

        // All three processes are retained (maxProcesses is 100), but only
        // the two newest checkpoint sessions keep their file.
        await expect(stat(checkpointFilePath(root, "oldest"))).rejects.toThrow();
        await expect(stat(checkpointFilePath(root, "middle"))).resolves.toBeTruthy();
        await expect(stat(checkpointFilePath(root, "newest"))).resolves.toBeTruthy();

        const restored = await journal.load();
        expect(restored.processes.map((process) => process.id).sort()).toEqual(["middle", "newest", "oldest"]);
        expect(restored.checkpointSessions.map((session) => session.processId).sort()).toEqual(["middle", "newest"]);
        expect(await restored.checkpointSessions.find((session) => session.processId === "middle")!.loadCheckpoint()).toBeDefined();
        expect(await restored.checkpointSessions.find((session) => session.processId === "newest")!.loadCheckpoint()).toBeDefined();
    });

    it("retains a completed process's checkpoint by recency, not by state (tasks 1.3/4.3)", async () => {
        const root = await temporaryRoot();
        const filePath = path.join(root, "tracked.txt");
        await writeFile(filePath, "before");
        const checkpoint = await captureCheckpoint(root);
        await writeFile(filePath, "after");
        checkpoint.delta = await finalizeCheckpoint(checkpoint);
        const serialized = serializeCheckpoint(checkpoint);
        const journal = new WorkbenchRunJournal(root, { maxCheckpointSessions: 2 });
        const data = {
            processes: [
                { id: "completed-recent", operation: "implement", mutating: true, state: "completed" as const, createdAt: "2026-08-08T10:00:00.000Z" },
                { id: "failed-older", operation: "implement", mutating: true, state: "failed" as const, createdAt: "2026-08-07T10:00:00.000Z" },
            ],
            checkpointSessions: [
                { processId: "completed-recent", checkpoint: serialized },
                { processId: "failed-older", checkpoint: serialized },
            ],
        };

        await journal.save(data);

        // Both are inside the retention count (2), so a "completed" state
        // is not evicted ahead of a "failed" one — retention here is by
        // recency alone.
        const restored = await journal.load();
        expect(restored.checkpointSessions.map((session) => session.processId).sort()).toEqual(["completed-recent", "failed-older"]);
        const resolved = await restored.checkpointSessions.find((session) => session.processId === "completed-recent")!.loadCheckpoint();
        expect(resolved).toBeDefined();
        expect(resolved!.checkpoint.before[0]!.path).toBe("tracked.txt");

        // And its rollback still works: retention by recency did not cost
        // the completed run its ability to be rolled back.
        const result = await rollbackCheckpoint(deserializeCheckpoint(resolved!.checkpoint));
        expect(result.conflicts).toEqual([]);
        expect(await readFile(filePath, "utf8")).toBe("before");
    });

    it("rejects corrupt data without replacing it", async () => {
        const root = await temporaryRoot();
        const journal = new WorkbenchRunJournal(root);
        await journal.save({ processes: [], checkpointSessions: [] });
        await writeFile(journal.filePath, "not json", "utf8");

        await expect(journal.load()).rejects.toThrow("not valid JSON");
        expect(await readFile(journal.filePath, "utf8")).toBe("not json");
    });

    it("rejects unsupported journal versions without replacing them", async () => {
        const root = await temporaryRoot();
        const journal = new WorkbenchRunJournal(root);
        await journal.save({ processes: [], checkpointSessions: [] });
        const unsupported = JSON.stringify({ version: 99, processes: [], checkpointSessions: [] });
        await writeFile(journal.filePath, unsupported, "utf8");

        const error = await journal.load().catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(WorkbenchJournalLoadError);
        expect(error).toMatchObject({
            code: "unsupported-journal-version",
            journalPath: journal.filePath,
            foundVersion: 99,
            supportedVersion: 3,
        });
        expect((error as Error).message).toContain("Upgrade OpenSpec UI");
        expect(await readFile(journal.filePath, "utf8")).toBe(unsupported);
    });

    it("distinguishes unsupported checkpoint versions found while migrating a version-1 journal", async () => {
        const root = await temporaryRoot();
        const checkpoint = serializeCheckpoint(await captureCheckpoint(root));
        const journal = new WorkbenchRunJournal(root);
        await journal.save({ processes: [], checkpointSessions: [] });
        const unsupported = JSON.stringify({
            version: 1,
            processes: [{ id: "run-1", operation: "implement", mutating: true, state: "interrupted" }],
            checkpointSessions: [{
                processId: "run-1",
                checkpoint: { ...checkpoint, version: 99 },
            }],
        });
        await writeFile(journal.filePath, unsupported, "utf8");

        const error = await journal.load().catch((caught: unknown) => caught);
        expect(error).toMatchObject({
            code: "unsupported-checkpoint-version",
            journalPath: journal.filePath,
            foundVersion: 99,
            supportedVersion: 1,
        });
        expect(await readFile(journal.filePath, "utf8")).toBe(unsupported);
    });

    it("reports workspace mismatches found while migrating a version-1 journal without replacing it", async () => {
        const root = await temporaryRoot();
        const otherRoot = await temporaryRoot();
        const checkpoint = serializeCheckpoint(await captureCheckpoint(otherRoot));
        const journal = new WorkbenchRunJournal(root);
        await journal.save({ processes: [], checkpointSessions: [] });
        const mismatched = JSON.stringify({
            version: 1,
            processes: [{ id: "run-1", operation: "implement", mutating: true, state: "interrupted" }],
            checkpointSessions: [{ processId: "run-1", checkpoint }],
        });
        await writeFile(journal.filePath, mismatched, "utf8");

        const error = await journal.load().catch((caught: unknown) => caught);
        expect(error).toMatchObject({ code: "workspace-mismatch", journalPath: journal.filePath });
        expect(await readFile(journal.filePath, "utf8")).toBe(mismatched);
    });
});
