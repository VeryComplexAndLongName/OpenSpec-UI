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

/** Polls with real timers until `scheduler.list()` reports `id` in `state`
 * — needed wherever a lease is configured, since `WorkspaceLeaseManager`
 * does real file I/O before a process reaches "running"/"suspended", not
 * just microtasks a `Promise.resolve()` chain would flush. */
async function waitForState(
  scheduler: WorkbenchProcessScheduler,
  id: string,
  state: string,
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (scheduler.list().find((process) => process.id === id)?.state === state) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for process "${id}" to reach state "${state}"`);
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

  it("restores a suspended process as interrupted, with a reason naming that the host awaiting its signal is gone (task 1.3)", () => {
    const scheduler = new WorkbenchProcessScheduler([{
      id: "waiting",
      operation: "implement",
      changeName: "demo",
      mutating: true,
      state: "suspended",
      waitingFor: "a CI run to finish",
      createdAt: "2026-08-08T10:00:00.000Z",
      startedAt: "2026-08-08T10:00:01.000Z",
    }]);

    const restored = scheduler.list()[0];
    expect(restored?.state).toBe("interrupted");
    expect(restored?.waitingFor).toBeUndefined();
    expect(restored?.error).toContain("a CI run to finish");
  });
});

describe("WorkbenchProcessScheduler suspend/resume", () => {
  it("suspends a process and releases the mutation lock for another queued mutation (tasks 2.1, 2.2)", async () => {
    const scheduler = new WorkbenchProcessScheduler();
    const order: string[] = [];
    const first = scheduler.start({
      id: "first",
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async ({ suspend }) => {
        order.push("first:start");
        await suspend("waiting for CI", { timeoutMs: 60_000 });
        order.push("first:resumed");
      },
    });
    const second = scheduler.start({
      id: "second",
      operation: "implement",
      changeName: "other",
      mutating: true,
      execute: async () => { order.push("second:ran"); },
    });

    await second.completion;
    expect(order).toEqual(["first:start", "second:ran"]);
    expect(scheduler.list().find((process) => process.id === "first")).toMatchObject({
      state: "suspended",
      waitingFor: "waiting for CI",
    });

    expect(scheduler.resumeProcess("first")).toBe(true);
    await first.completion;
    expect(order).toEqual(["first:start", "second:ran", "first:resumed"]);
    expect(scheduler.list().find((process) => process.id === "first")).toMatchObject({
      state: "completed",
      waitingFor: undefined,
    });
  });

  it("requeues a resumed process rather than running it directly, so two resumed together still serialize (task 2.3)", async () => {
    const scheduler = new WorkbenchProcessScheduler();
    const order: string[] = [];
    const gate = deferred<void>();

    const first = scheduler.start({
      id: "first",
      operation: "implement",
      changeName: "one",
      mutating: true,
      execute: async ({ suspend }) => {
        await suspend("first-wait", { timeoutMs: 60_000 });
        order.push("first:start");
        await gate.promise;
        order.push("first:end");
      },
    });
    const second = scheduler.start({
      id: "second",
      operation: "implement",
      changeName: "two",
      mutating: true,
      execute: async ({ suspend }) => {
        await suspend("second-wait", { timeoutMs: 60_000 });
        order.push("second:start");
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(scheduler.list().map((process) => process.state)).toEqual(["suspended", "suspended"]);

    expect(scheduler.resumeProcess("first")).toBe(true);
    expect(scheduler.resumeProcess("second")).toBe(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(scheduler.list().find((process) => process.id === "first")?.state).toBe("running");
    expect(scheduler.list().find((process) => process.id === "second")?.state).toBe("queued");

    gate.resolve();
    await Promise.all([first.completion, second.completion]);
    expect(order).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("resumeProcess returns false for a process that is not suspended", async () => {
    const scheduler = new WorkbenchProcessScheduler();
    const handle = scheduler.start({
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async () => "done",
    });
    await handle.completion;

    expect(scheduler.resumeProcess(handle.id)).toBe(false);
    expect(scheduler.resumeProcess("does-not-exist")).toBe(false);
  });

  it("fails a suspended process when its timeout elapses, naming what it awaited and for how long (task 2.4)", async () => {
    vi.useFakeTimers();
    try {
      const scheduler = new WorkbenchProcessScheduler();
      const handle = scheduler.start({
        operation: "implement",
        changeName: "demo",
        mutating: true,
        execute: async ({ suspend }) => { await suspend("a webhook that never arrives", { timeoutMs: 5000 }); },
      });

      const completion = handle.completion;
      await vi.advanceTimersByTimeAsync(5000);
      const process = await completion;

      expect(process.state).toBe("failed");
      expect(process.error).toContain("a webhook that never arrives");
      expect(process.error).toContain("5000");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a suspension timeout fails the process and leaves the lock free for the next queued mutation (task 7.2)", async () => {
    vi.useFakeTimers();
    try {
      const scheduler = new WorkbenchProcessScheduler();
      const order: string[] = [];

      const first = scheduler.start({
        operation: "implement",
        changeName: "one",
        mutating: true,
        execute: async ({ suspend }) => { await suspend("a signal that never comes", { timeoutMs: 5000 }); },
      });
      const second = scheduler.start({
        operation: "implement",
        changeName: "two",
        mutating: true,
        execute: async () => { order.push("second:ran"); return "done"; },
      });

      await vi.advanceTimersByTimeAsync(5000);
      const firstResult = await first.completion;
      const secondResult = await second.completion;

      expect(firstResult.state).toBe("failed");
      expect(firstResult.error).toContain("a signal that never comes");
      expect(secondResult.state).toBe("completed");
      expect(order).toEqual(["second:ran"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a suspended process immediately, without waiting for its signal (task 2.5)", async () => {
    const scheduler = new WorkbenchProcessScheduler();
    const handle = scheduler.start({
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async ({ suspend }) => { await suspend("waiting forever", { timeoutMs: 60_000 }); },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(scheduler.list()[0]?.state).toBe("suspended");

    expect(handle.cancel()).toBe(true);
    const process = await handle.completion;
    expect(process.state).toBe("cancelled");
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

  it("releases the lease on suspension and re-acquires it on resume (task 3.3)", async () => {
    const root = await temporaryRoot();
    const lease = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
    const scheduler = new WorkbenchProcessScheduler([], lease);

    const handle = scheduler.start({
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async ({ suspend }) => { await suspend("waiting", { timeoutMs: 60_000 }); return "done"; },
    });
    await waitForState(scheduler, handle.id, "suspended");

    // The lease was released: a foreign host can acquire it while this one waits.
    const foreignLease = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension" });
    const acquireResult = await foreignLease.acquireOrRenew();
    expect(acquireResult.ok).toBe(true);
    await foreignLease.release();

    expect(scheduler.resumeProcess(handle.id)).toBe(true);
    const process = await handle.completion;
    expect(process.state).toBe("completed");
  });

  it("leaves a resumed process queued and unrun when it cannot reacquire the lease (task 3.3)", async () => {
    const root = await temporaryRoot();
    const lease = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
    const scheduler = new WorkbenchProcessScheduler([], lease);
    const started = vi.fn();

    const handle = scheduler.start({
      operation: "implement",
      changeName: "demo",
      mutating: true,
      execute: async ({ suspend }) => { await suspend("waiting", { timeoutMs: 60_000 }); started(); },
    });
    await waitForState(scheduler, handle.id, "suspended");

    // A foreign host takes the lease while this one is suspended.
    const foreignLease = new WorkspaceLeaseManager(root, { hostKind: "vscode-extension" });
    await foreignLease.acquireOrRenew();

    expect(scheduler.resumeProcess(handle.id)).toBe(true);
    // Stays "queued" — a real, unresolvable lease conflict, so there is no
    // later state to poll for; a short real-time wait confirms it does not
    // silently proceed unlocked.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(started).not.toHaveBeenCalled();
    expect(scheduler.list()[0]?.state).toBe("queued");
  });

  it("end-to-end: suspending releases the lock and the lease so another mutation finishes, then resume reacquires and completes (task 7.1)", async () => {
    const root = await temporaryRoot();
    const lease = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
    const scheduler = new WorkbenchProcessScheduler([], lease);
    const order: string[] = [];

    const first = scheduler.start({
      id: "first",
      operation: "implement",
      changeName: "one",
      mutating: true,
      execute: async ({ suspend }) => {
        order.push("first:before-suspend");
        await suspend("waiting for an external signal", { timeoutMs: 60_000 });
        order.push("first:resumed");
        return "first done";
      },
    });

    await waitForState(scheduler, "first", "suspended");

    // A second mutating process is admitted and actually finishes while the
    // first waits — states alone would pass even if the lock were never
    // really released, so assert the execution order too.
    const second = await scheduler.start({
      id: "second",
      operation: "implement",
      changeName: "two",
      mutating: true,
      execute: async () => { order.push("second:ran"); return "second done"; },
    }).completion;

    expect(second.state).toBe("completed");
    expect(order).toEqual(["first:before-suspend", "second:ran"]);

    expect(scheduler.resumeProcess("first")).toBe(true);
    const firstResult = await first.completion;

    expect(firstResult.state).toBe("completed");
    expect(firstResult.summary).toBe("first done");
    expect(order).toEqual(["first:before-suspend", "second:ran", "first:resumed"]);
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
