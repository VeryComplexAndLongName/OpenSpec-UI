import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { captureCheckpoint, finalizeCheckpoint, serializeCheckpoint } from "./checkpoint.js";
import { WorkbenchRecoveryService } from "./workbench-recovery.js";
import { WorkbenchRunJournal } from "./workbench-run-journal.js";

const roots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-recovery-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("WorkbenchRecoveryService", () => {
  it("marks a running process interrupted and finalizes its checkpoint on restart", async () => {
    const root = await createRoot();
    const filePath = path.join(root, "tracked.txt");
    await writeFile(filePath, "before", "utf8");
    const checkpoint = await captureCheckpoint(root);
    await writeFile(filePath, "after", "utf8");
    await new WorkbenchRunJournal(root).save({
      processes: [{ id: "run-1", operation: "implement", mutating: true, state: "running", createdAt: "2026-08-01T00:00:00.000Z" }],
      checkpointSessions: [{ processId: "run-1", checkpoint: serializeCheckpoint(checkpoint) }],
    });

    const service = await WorkbenchRecoveryService.open(root);

    expect(service.list()[0]).toMatchObject({ id: "run-1", state: "interrupted", summary: "1 changed file ready for review" });
    expect(service.details("run-1")).toMatchObject({ canRollback: true, delta: [{ path: "tracked.txt", kind: "modified" }] });
  });

  it("filters newly excluded paths from a historical checkpoint in memory, without rewriting its finalized file", async () => {
    const root = await createRoot();
    await writeFile(path.join(root, "tracked.txt"), "before", "utf8");
    const checkpoint = await captureCheckpoint(root);
    await writeFile(path.join(root, "tracked.txt"), "after", "utf8");
    await finalizeCheckpoint(checkpoint);
    const serialized = serializeCheckpoint(checkpoint);
    const beforeSnapshot = serialized.before[0]!;
    const afterSnapshot = serialized.after![0]!;
    serialized.before.push({ ...beforeSnapshot, path: ".env" });
    serialized.before.push({ ...beforeSnapshot, path: ".mypy_cache/state.json" });
    serialized.after!.push({ ...afterSnapshot, path: ".env" });
    serialized.after!.push({ ...afterSnapshot, path: ".mypy_cache/state.json" });
    serialized.delta!.push({ path: ".env", kind: "modified" });
    serialized.delta!.push({ path: ".mypy_cache/state.json", kind: "modified" });
    const journal = new WorkbenchRunJournal(root);
    await journal.save({
      processes: [{ id: "run-1", operation: "implement", mutating: true, state: "completed", createdAt: "2026-08-01T00:00:00.000Z" }],
      checkpointSessions: [{ processId: "run-1", checkpoint: serialized }],
    });

    const service = await WorkbenchRecoveryService.open(root);

    // Exclusion filtering still applies wherever the checkpoint is
    // deserialized for use (details/rollback), even though the change's
    // "a finalized checkpoint is written once and is never rewritten"
    // invariant means the on-disk file below is left untouched.
    expect(service.details("run-1")?.delta?.map((item) => item.path)).toEqual(["tracked.txt"]);

    const persisted = await journal.load();
    const restoredCheckpoint = persisted.checkpointSessions[0]!.checkpoint;
    expect(restoredCheckpoint.before.map((item) => item.path)).toEqual(
      expect.arrayContaining([".env", ".mypy_cache/state.json", "tracked.txt"]),
    );
  });

  it("rolls back conflict-free files and reports later conflicts without partial writes", async () => {
    const root = await createRoot();
    const filePath = path.join(root, "tracked.txt");
    await writeFile(filePath, "before", "utf8");
    const checkpoint = await captureCheckpoint(root);
    await writeFile(filePath, "after", "utf8");
    await finalizeCheckpoint(checkpoint);
    await new WorkbenchRunJournal(root).save({
      processes: [{ id: "run-1", operation: "implement", mutating: true, state: "completed", createdAt: "2026-08-01T00:00:00.000Z" }],
      checkpointSessions: [{ processId: "run-1", checkpoint: serializeCheckpoint(checkpoint) }],
    });

    const service = await WorkbenchRecoveryService.open(root);
    await writeFile(filePath, "different", "utf8");
    await expect(service.rollback("run-1")).resolves.toEqual({ restored: [], conflicts: ["tracked.txt"] });
    expect(await readFile(filePath, "utf8")).toBe("different");
    expect(service.list()[0]?.state).toBe("completed");

    await writeFile(filePath, "after", "utf8");
    await expect(service.rollback("run-1")).resolves.toEqual({ restored: ["tracked.txt"], conflicts: [] });
    expect(await readFile(filePath, "utf8")).toBe("before");
    expect(service.list()[0]?.state).toBe("rolled-back");
  });

  it("rolls back every process for a change across multiple checkpoints, to the earliest state", async () => {
    const root = await createRoot();
    const filePath = path.join(root, "shared.txt");
    await writeFile(filePath, "v0", "utf8");
    const checkpoint1 = await captureCheckpoint(root);
    await writeFile(filePath, "v1", "utf8");
    await finalizeCheckpoint(checkpoint1);
    const checkpoint2 = await captureCheckpoint(root);
    await writeFile(filePath, "v2", "utf8");
    await finalizeCheckpoint(checkpoint2);
    await new WorkbenchRunJournal(root).save({
      processes: [
        { id: "run-1", operation: "implement", changeName: "demo-change", mutating: true, state: "completed", createdAt: "2026-08-01T00:00:00.000Z" },
        { id: "run-2", operation: "implement", changeName: "demo-change", mutating: true, state: "completed", createdAt: "2026-08-02T00:00:00.000Z" },
      ],
      checkpointSessions: [
        { processId: "run-1", changeName: "demo-change", checkpoint: serializeCheckpoint(checkpoint1) },
        { processId: "run-2", changeName: "demo-change", checkpoint: serializeCheckpoint(checkpoint2) },
      ],
    });

    const service = await WorkbenchRecoveryService.open(root);
    expect(service.changeRollbackDetails("demo-change")).toEqual({ processCount: 2, fileCount: 1 });

    await expect(service.rollbackChange("demo-change")).resolves.toEqual({ restored: ["shared.txt"], conflicts: [] });
    expect(await readFile(filePath, "utf8")).toBe("v0");
    expect(service.list().map((process) => process.state)).toEqual(["rolled-back", "rolled-back"]);
  });

  it("throws for a change with no rollback-eligible processes", async () => {
    const root = await createRoot();
    const service = await WorkbenchRecoveryService.open(root);
    await expect(service.rollbackChange("nonexistent")).rejects.toThrow(
      'No rollback-eligible processes for change "nonexistent"',
    );
    expect(service.changeRollbackDetails("nonexistent")).toBeUndefined();
  });

  it("cleans old processes and their checkpoint sessions together", async () => {
    const root = await createRoot();
    const checkpoint = await captureCheckpoint(root);
    await finalizeCheckpoint(checkpoint);
    await new WorkbenchRunJournal(root).save({
      processes: [
        { id: "old", operation: "review", mutating: false, state: "completed", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "new", operation: "review", mutating: false, state: "completed", createdAt: "2026-08-01T00:00:00.000Z" },
      ],
      checkpointSessions: [{ processId: "old", checkpoint: serializeCheckpoint(checkpoint) }],
    });

    const service = await WorkbenchRecoveryService.open(root);
    await expect(service.cleanupBefore(new Date("2026-07-01T00:00:00.000Z"))).resolves.toEqual({ removed: 1, retained: 1 });
    const persisted = await new WorkbenchRunJournal(root).load();
    expect(persisted.processes.map((process) => process.id)).toEqual(["new"]);
    expect(persisted.checkpointSessions).toEqual([]);
  });
});
