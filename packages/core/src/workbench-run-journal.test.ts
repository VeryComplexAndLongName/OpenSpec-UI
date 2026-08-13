import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { captureCheckpoint, serializeCheckpoint } from "./checkpoint.js";
import {
    WorkbenchJournalLoadError,
    WorkbenchRunJournal,
} from "./workbench-run-journal.js";

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-journal-"));
    roots.push(root);
    return root;
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
        expect(restored.checkpointSessions[0]!.checkpoint.before[0]!.path).toBe("tracked.txt");
    });

    it("retains only the configured newest processes and matching checkpoints", async () => {
        const root = await temporaryRoot();
        const checkpoint = serializeCheckpoint(await captureCheckpoint(root));
        const journal = new WorkbenchRunJournal(root, { maxProcesses: 1 });
        await journal.save({
            processes: [
                { id: "old", operation: "status", mutating: false, state: "completed", createdAt: "2026-08-07T10:00:00.000Z" },
                { id: "new", operation: "implement", mutating: true, state: "completed", createdAt: "2026-08-08T10:00:00.000Z" },
            ],
            checkpointSessions: [
                { processId: "old", checkpoint },
                { processId: "new", checkpoint },
            ],
        });

        const restored = await journal.load();
        expect(restored.processes.map((process) => process.id)).toEqual(["new"]);
        expect(restored.checkpointSessions.map((session) => session.processId)).toEqual(["new"]);
    });

    it("rejects corrupt data without replacing it", async () => {
        const root = await temporaryRoot();
        const journal = new WorkbenchRunJournal(root);
        await journal.save({ processes: [], checkpointSessions: [] });
        await writeFile(journal.filePath, "not json", "utf8");

        await expect(journal.load()).rejects.toThrow("not valid JSON");
        expect(await readFile(journal.filePath, "utf8")).toBe("not json");
    });

    it("rejects unsupported versions without replacing them", async () => {
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
            supportedVersion: 1,
        });
        expect((error as Error).message).toContain("Upgrade OpenSpec UI");
        expect(await readFile(journal.filePath, "utf8")).toBe(unsupported);
    });

    it("distinguishes unsupported checkpoint versions without replacing the journal", async () => {
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

    it("reports workspace mismatches as structured diagnostics without replacing the journal", async () => {
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
