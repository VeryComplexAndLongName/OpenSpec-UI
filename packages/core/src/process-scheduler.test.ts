import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkbenchProcessScheduler } from "./process-scheduler.js";
import { WorkspaceLeaseManager } from "./workspace-lease.js";

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

  it("removeBefore drops only processes created before the cutoff, in place", () => {
    const scheduler = new WorkbenchProcessScheduler([
      { id: "old", operation: "review", mutating: false, state: "completed", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "new", operation: "review", mutating: false, state: "completed", createdAt: "2026-08-01T00:00:00.000Z" },
    ]);

    const removed = scheduler.removeBefore(new Date("2026-07-01T00:00:00.000Z"));

    expect(removed).toEqual(["old"]);
    expect(scheduler.list().map((process) => process.id)).toEqual(["new"]);
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

describe("WorkbenchProcessScheduler cross-host workspace lease", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function temporaryRoot(): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-scheduler-lease-"));
    roots.push(root);
    return root;
  }

  it("runs a mutating process normally when no other host holds the lease", async () => {
    const root = await temporaryRoot();
    const lease = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
    const scheduler = new WorkbenchProcessScheduler([], lease);

    const handle = scheduler.start({
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async () => "done",
    });

    const process = await handle.completion;
    expect(process.state).toBe("completed");
  });

  it("fails a mutating run immediately, without queuing, when a foreign host holds a live lease", async () => {
    const root = await temporaryRoot();
    const foreignLease = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension" });
    await foreignLease.acquireOrRenew();

    const lease = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
    const scheduler = new WorkbenchProcessScheduler([], lease);
    const started = vi.fn();
    const handle = scheduler.start({
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async () => { started(); },
    });

    const process = await handle.completion;

    expect(started).not.toHaveBeenCalled();
    expect(process.state).toBe("failed");
    expect(process.error).toContain("VS Code extension");
    expect(process.startedAt).toBeUndefined();
  });

  it("reclaims and runs once a foreign lease has gone stale", async () => {
    const root = await temporaryRoot();
    const foreignLease = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension" });
    await foreignLease.acquireOrRenew();
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Staleness is judged by the evaluating (this) manager's own threshold.
    const lease = new WorkspaceLeaseManager(root, { hostKind: "standalone-server", staleAfterMs: 1 });
    const scheduler = new WorkbenchProcessScheduler([], lease);
    const handle = scheduler.start({
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async () => "done",
    });

    const process = await handle.completion;

    expect(process.state).toBe("completed");
    expect(process.progress).toContain("Reclaimed");
  });

  it("releases the lease on completion so a second host can then mutate", async () => {
    const root = await temporaryRoot();
    const firstLease = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
    const firstScheduler = new WorkbenchProcessScheduler([], firstLease);
    await (await firstScheduler.start({
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async () => "done",
    }).completion);

    const secondLease = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension" });
    const secondScheduler = new WorkbenchProcessScheduler([], secondLease);
    const second = await secondScheduler.start({
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async () => "done",
    }).completion;

    expect(second.state).toBe("completed");
  });

  it("does not gate read-only runs on the lease at all", async () => {
    const root = await temporaryRoot();
    const foreignLease = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension" });
    await foreignLease.acquireOrRenew();

    const lease = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
    const scheduler = new WorkbenchProcessScheduler([], lease);
    const process = await scheduler.start({
      operation: "status",
      changeName: "demo",
      mutating: false,
      execute: async () => "ok",
    }).completion;

    expect(process.state).toBe("completed");
  });
});
