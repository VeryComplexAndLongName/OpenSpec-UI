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
