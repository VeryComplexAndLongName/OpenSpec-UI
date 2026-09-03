import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { captureCheckpoint, serializeCheckpoint, WorkbenchProcessScheduler } from "@openspec-ui/core";
import { ImplementationSessionManager } from "./implementation-sessions.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ImplementationSessionManager", () => {
  it("captures an implementation delta and rolls it back", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-session-"));
    roots.push(root);
    const filePath = path.join(root, "code.ts");
    await writeFile(filePath, "before");
    const scheduler = new WorkbenchProcessScheduler();
    const manager = new ImplementationSessionManager(scheduler);

    const processId = await manager.start(root, "demo");
    await writeFile(filePath, "after");
    expect(manager.finish(processId)).toBe(true);
    await new Promise<void>((resolve) => {
      const unsubscribe = scheduler.onDidChange((processes) => {
        if (processes.find((process) => process.id === processId)?.state === "completed") {
          unsubscribe();
          resolve();
        }
      });
    });

    expect(manager.getDelta(processId)).toEqual([
      expect.objectContaining({ path: "code.ts", kind: "modified" }),
    ]);
    expect((await manager.rollback(processId)).conflicts).toEqual([]);
    expect(await readFile(filePath, "utf8")).toBe("before");
  });

  it("finalizes and rolls back an interrupted persisted session", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-session-"));
    roots.push(root);
    const filePath = path.join(root, "code.ts");
    await writeFile(filePath, "before");
    const checkpoint = await captureCheckpoint(root);
    await writeFile(filePath, "interrupted agent state");
    const scheduler = new WorkbenchProcessScheduler([{
      id: "recovered",
      operation: "implement",
      changeName: "demo",
      mutating: true,
      state: "running",
      createdAt: "2026-08-08T10:00:00.000Z",
    }]);
    const manager = new ImplementationSessionManager(scheduler);

    await manager.restore([{
      processId: "recovered",
      changeName: "demo",
      loadCheckpoint: async () => ({
        processId: "recovered",
        changeName: "demo",
        checkpoint: serializeCheckpoint(checkpoint),
      }),
    }]);

    expect(scheduler.list()[0]).toMatchObject({ state: "interrupted", summary: "1 changed file ready for review" });
    expect(manager.getDelta("recovered")).toEqual([
      expect.objectContaining({ path: "code.ts", kind: "modified" }),
    ]);
    expect((await manager.rollback("recovered")).conflicts).toEqual([]);
    expect(await readFile(filePath, "utf8")).toBe("before");
  });

  it("sanitizes excluded paths when restoring historical sessions", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-session-"));
    roots.push(root);
    await writeFile(path.join(root, "code.ts"), "before");
    const serialized = serializeCheckpoint(await captureCheckpoint(root));
    const snapshot = serialized.before[0]!;
    serialized.before.push({ ...snapshot, path: ".env" });
    serialized.before.push({ ...snapshot, path: ".pytest_cache/state.json" });
    const scheduler = new WorkbenchProcessScheduler([{
      id: "recovered",
      operation: "archive",
      changeName: "demo",
      mutating: true,
      state: "completed",
      createdAt: "2026-08-08T10:00:00.000Z",
    }]);
    let persistRequests = 0;
    const manager = new ImplementationSessionManager(scheduler, () => { persistRequests += 1; });

    await manager.restore([{
      processId: "recovered",
      changeName: "demo",
      loadCheckpoint: async () => ({ processId: "recovered", changeName: "demo", checkpoint: serialized }),
    }]);

    expect(manager.exportPersisted()[0]!.checkpoint.before.map((item) => item.path)).toEqual(["code.ts"]);
    expect(persistRequests).toBe(1);
  });

  it("preserves rollback state when a lifecycle mutation fails", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-session-"));
    roots.push(root);
    const filePath = path.join(root, "change.md");
    await writeFile(filePath, "before");
    const scheduler = new WorkbenchProcessScheduler();
    const manager = new ImplementationSessionManager(scheduler);

    const process = await manager.run(root, {
      operation: "archive",
      changeName: "demo",
      mutating: true,
      execute: async () => {
        await writeFile(filePath, "partially archived");
        throw new Error("archive failed");
      },
    });

    expect(process).toMatchObject({ state: "failed", error: "archive failed" });
    expect(manager.getDelta(process.id)).toEqual([
      expect.objectContaining({ path: "change.md", kind: "modified" }),
    ]);
    expect((await manager.rollback(process.id)).conflicts).toEqual([]);
    expect(await readFile(filePath, "utf8")).toBe("before");
  });

  it("rolls back every session for a change across two runs, to the earliest state", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-session-"));
    roots.push(root);
    const filePath = path.join(root, "shared.txt");
    await writeFile(filePath, "v0");
    const scheduler = new WorkbenchProcessScheduler();
    const manager = new ImplementationSessionManager(scheduler);

    await manager.run(root, {
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async () => { await writeFile(filePath, "v1"); },
    });
    await manager.run(root, {
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async () => { await writeFile(filePath, "v2"); },
    });

    expect(manager.changeRollbackDetails("demo")).toEqual({ processCount: 2, fileCount: 1 });
    await expect(manager.rollbackChange("demo")).resolves.toEqual({ restored: ["shared.txt"], conflicts: [] });
    expect(await readFile(filePath, "utf8")).toBe("v0");
  });

  it("throws rollbackChange for a change with no rollback-eligible sessions", async () => {
    const scheduler = new WorkbenchProcessScheduler();
    const manager = new ImplementationSessionManager(scheduler);
    await expect(manager.rollbackChange("nonexistent")).rejects.toThrow(
      'No rollback-eligible processes for change "nonexistent"',
    );
    expect(manager.changeRollbackDetails("nonexistent")).toBeUndefined();
  });

  it("dropSessions removes a session so it no longer participates in change rollback", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-session-"));
    roots.push(root);
    const filePath = path.join(root, "code.ts");
    await writeFile(filePath, "before");
    const scheduler = new WorkbenchProcessScheduler();
    const manager = new ImplementationSessionManager(scheduler);

    const process = await manager.run(root, {
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async () => { await writeFile(filePath, "after"); },
    });

    manager.dropSessions([process.id]);

    expect(manager.getDelta(process.id)).toBeUndefined();
    expect(manager.changeRollbackDetails("demo")).toBeUndefined();
  });
});
