import { describe, expect, it, vi } from "vitest";
import { WorkbenchProcessScheduler } from "./process-scheduler.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("WorkbenchProcessScheduler", () => {
  it("serializes workspace mutations across different changes", async () => {
    const scheduler = new WorkbenchProcessScheduler();
    const firstGate = deferred<void>();
    const order: string[] = [];
    const first = scheduler.start({
      id: "first",
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async () => { order.push("first:start"); await firstGate.promise; order.push("first:end"); },
    });
    const second = scheduler.start({
      id: "second",
      operation: "archive",
      changeName: "other",
      mutating: true,
      execute: async () => { order.push("second:start"); },
    });

    await Promise.resolve();
    expect(scheduler.list().find((process) => process.id === "second")?.state).toBe("queued");
    firstGate.resolve();
    await Promise.all([first.completion, second.completion]);
    expect(order).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("runs read-only work concurrently while a second mutation waits", async () => {
    const scheduler = new WorkbenchProcessScheduler();
    const gate = deferred<void>();
    const started = vi.fn();
    const first = scheduler.start({
      operation: "implement",
      changeName: "one",
      mutating: true,
      execute: async () => { started("one"); await gate.promise; },
    });
    const second = scheduler.start({
      operation: "implement",
      changeName: "two",
      mutating: true,
      execute: async () => { started("two"); },
    });
    const status = scheduler.start({
      operation: "status",
      changeName: "one",
      mutating: false,
      execute: async () => { started("status"); },
    });

    await status.completion;
    expect(started).toHaveBeenCalledTimes(2);
    expect(scheduler.list().find((process) => process.id === second.id)?.state).toBe("queued");
    gate.resolve();
    await Promise.all([first.completion, second.completion]);
    expect(started).toHaveBeenCalledTimes(3);
  });

  it("reports progress and cancels queued work", async () => {
    const scheduler = new WorkbenchProcessScheduler();
    const gate = deferred<void>();
    const first = scheduler.start({
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async ({ report }) => { report("editing files"); await gate.promise; },
    });
    const queued = scheduler.start({
      operation: "archive",
      changeName: "demo",
      mutating: true,
      execute: async () => undefined,
    });

    expect(queued.cancel()).toBe(true);
    expect((await queued.completion).state).toBe("cancelled");
    expect(scheduler.list().find((process) => process.id === first.id)?.progress).toBe("editing files");
    gate.resolve();
    await first.completion;
  });

  it("marks a completed process as rolled back", async () => {
    const scheduler = new WorkbenchProcessScheduler();
    const handle = scheduler.start({
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async () => "one file changed",
    });
    await handle.completion;

    expect(scheduler.markRolledBack(handle.id, "one file restored")).toBe(true);
    expect(scheduler.list()[0]).toMatchObject({ state: "rolled-back", summary: "one file restored" });
  });

  it("restores unfinished processes as interrupted", () => {
    const scheduler = new WorkbenchProcessScheduler([{
      id: "active",
      operation: "implement",
      changeName: "demo",
      mutating: true,
      state: "running",
      createdAt: "2026-08-08T10:00:00.000Z",
      startedAt: "2026-08-08T10:00:01.000Z",
    }]);

    expect(scheduler.list()[0]).toMatchObject({
      id: "active",
      state: "interrupted",
      error: "Workbench host stopped before this process completed",
    });
  });
});
