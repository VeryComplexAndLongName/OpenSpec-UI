import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { captureCheckpoint, finalizeCheckpoint, serializeCheckpoint, WorkbenchProcessScheduler } from "@openspec-ui/core";
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

    expect(await manager.getDelta(processId)).toEqual([
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
    expect(await manager.getDelta("recovered")).toEqual([
      expect.objectContaining({ path: "code.ts", kind: "modified" }),
    ]);
    expect((await manager.rollback("recovered")).conflicts).toEqual([]);
    expect(await readFile(filePath, "utf8")).toBe("before");
  });

  it("rolls back a completed session the same way after a lazy restore (task 4.6)", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-session-"));
    roots.push(root);
    const filePath = path.join(root, "code.ts");
    await writeFile(filePath, "before");
    const checkpoint = await captureCheckpoint(root);
    await writeFile(filePath, "after rollback-eligible run");
    const delta = await finalizeCheckpoint(checkpoint);
    const serialized = serializeCheckpoint(checkpoint);
    serialized.delta = delta;
    const scheduler = new WorkbenchProcessScheduler([{
      id: "completed-run",
      operation: "implement",
      changeName: "demo",
      mutating: true,
      state: "completed",
      createdAt: "2026-08-08T10:00:00.000Z",
    }]);
    const manager = new ImplementationSessionManager(scheduler);
    let loadCalls = 0;

    // Restoring through the same `loadCheckpoint()` indirection `restore()`
    // uses in production — the saving here is bounded by retention (task
    // 1), and this asserts the rollback outcome is unaffected by going
    // through that indirection rather than an inline payload.
    await manager.restore([{
      processId: "completed-run",
      changeName: "demo",
      loadCheckpoint: async () => {
        loadCalls += 1;
        return { processId: "completed-run", changeName: "demo", checkpoint: serialized };
      },
    }]);

    expect(loadCalls).toBe(0);
    expect(await manager.getDelta("completed-run")).toEqual([
      expect.objectContaining({ path: "code.ts", kind: "modified" }),
    ]);
    expect(loadCalls).toBe(1);
    expect((await manager.rollback("completed-run")).conflicts).toEqual([]);
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

    await manager.getCoverage("recovered");
    expect(manager.exportPersisted()[0]!.checkpoint?.before.map((item) => item.path)).toEqual(["code.ts"]);
    expect(persistRequests).toBe(1);
  });

  it("restores without reading checkpoints except interrupted sessions with no delta (task 4.5)", async () => {
    const scheduler = new WorkbenchProcessScheduler([
      {
        id: "completed",
        operation: "implement",
        changeName: "demo",
        mutating: true,
        state: "completed",
        createdAt: "2026-08-08T10:00:00.000Z",
      },
      {
        id: "interrupted-with-delta",
        operation: "implement",
        changeName: "demo",
        mutating: true,
        state: "interrupted",
        createdAt: "2026-08-08T10:01:00.000Z",
      },
      {
        id: "interrupted-without-delta",
        operation: "implement",
        changeName: "demo",
        mutating: true,
        state: "interrupted",
        createdAt: "2026-08-08T10:02:00.000Z",
      },
    ]);
    const manager = new ImplementationSessionManager(scheduler);
    let loadCalls = 0;

    await manager.restore([
      {
        processId: "completed",
        changeName: "demo",
        hasAfter: true,
        delta: [{ path: "completed.ts", kind: "modified", beforeHash: "a", afterHash: "b" }],
        coverage: { excludedDirectories: [], skippedFiles: [] },
        loadCheckpoint: async () => {
          loadCalls += 1;
          return undefined;
        },
      },
      {
        processId: "interrupted-with-delta",
        changeName: "demo",
        hasAfter: true,
        delta: [{ path: "interrupted.ts", kind: "modified", beforeHash: "a", afterHash: "b" }],
        coverage: { excludedDirectories: [], skippedFiles: [] },
        loadCheckpoint: async () => {
          loadCalls += 1;
          return undefined;
        },
      },
      {
        processId: "interrupted-without-delta",
        changeName: "demo",
        loadCheckpoint: async () => {
          loadCalls += 1;
          const root = await mkdtemp(path.join(os.tmpdir(), "openspec-session-"));
          roots.push(root);
          await writeFile(path.join(root, "code.ts"), "before");
          const checkpoint = await captureCheckpoint(root);
          await writeFile(path.join(root, "code.ts"), "after");
          return {
            processId: "interrupted-without-delta",
            changeName: "demo",
            checkpoint: serializeCheckpoint(checkpoint),
          };
        },
      },
    ]);

    expect(loadCalls).toBe(1);
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
    expect(await manager.getDelta(process.id)).toEqual([
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

    expect(await manager.changeRollbackDetails("demo")).toEqual({ processCount: 2, fileCount: 1 });
    await expect(manager.rollbackChange("demo")).resolves.toEqual({ restored: ["shared.txt"], conflicts: [] });
    expect(await readFile(filePath, "utf8")).toBe("v0");
  });

  it("throws rollbackChange for a change with no rollback-eligible sessions", async () => {
    const scheduler = new WorkbenchProcessScheduler();
    const manager = new ImplementationSessionManager(scheduler);
    await expect(manager.rollbackChange("nonexistent")).rejects.toThrow(
      'No rollback-eligible processes for change "nonexistent"',
    );
    expect(await manager.changeRollbackDetails("nonexistent")).toBeUndefined();
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

    expect(await manager.getDelta(process.id)).toBeUndefined();
    expect(await manager.changeRollbackDetails("demo")).toBeUndefined();
  });
});
