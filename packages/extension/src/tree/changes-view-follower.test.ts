import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();

/** A watcher whose events a test fires, and whose disposal it can see. As
 * VS Code's does, it delivers nothing once disposed. */
function createWatcherFixture(pattern: { base: { fsPath: string }; pattern: string }) {
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return { dispose: () => { listeners.delete(listener); } };
  };
  const watcher = {
    pattern,
    disposed: false,
    onDidCreate: vi.fn(subscribe),
    onDidChange: vi.fn(subscribe),
    onDidDelete: vi.fn(subscribe),
    dispose: () => { watcher.disposed = true; },
    fire: () => {
      if (watcher.disposed) return;
      for (const listener of listeners) listener();
    },
  };
  return watcher;
}

let watchers: Array<ReturnType<typeof createWatcherFixture>> = [];

vi.mock("vscode", () => ({
  ...vscodeMock,
  RelativePattern: class {
    constructor(public base: unknown, public pattern: string) { }
  },
  workspace: {
    ...vscodeMock.workspace,
    createFileSystemWatcher: vi.fn((pattern: { base: { fsPath: string }; pattern: string }) => {
      const watcher = createWatcherFixture(pattern);
      watchers.push(watcher);
      return watcher;
    }),
  },
}));
vi.mock("@openspec-ui/core", () => ({
  STANDING_FETCH_INTERVAL_MS: 300_000,
  createGitWrapper: vi.fn(),
  resolveAgentStatusDirectory: vi.fn(),
}));

const { CHANGES_RECORDS_EVENT_WINDOW_MS, followChangesView } = await import("./changes-view-follower.js");

// the-changes-views-see-a-run-start 2.6: the standing timer and the records
// watcher, both only while the Changes view is visible.

function viewFixture(visible: boolean) {
  const listeners: Array<(event: { visible: boolean }) => void> = [];
  return {
    visible,
    onDidChangeVisibility: vi.fn((listener: (event: { visible: boolean }) => void) => {
      listeners.push(listener);
      return { dispose: vi.fn() };
    }),
    show: (next: boolean) => { for (const listener of listeners) listener({ visible: next }); },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  watchers = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("followChangesView", () => {
  it("watches the resolved status directory while the view is visible, and lets go of it and the timer when hidden", async () => {
    const view = viewFixture(true);
    const tree = { refresh: vi.fn(), refreshRuns: vi.fn() };
    const follower = followChangesView({ workspaceRoot: "/repo", view, tree, statusDirectory: async () => "/wt/repo/.agent-status" });
    await vi.advanceTimersByTimeAsync(0);

    expect(watchers).toHaveLength(1);
    expect(watchers[0]?.pattern.base.fsPath).toBe("/wt/repo/.agent-status");
    expect(watchers[0]?.pattern.pattern).toBe("*.json");
    await vi.advanceTimersByTimeAsync(300_000);
    expect(tree.refresh).toHaveBeenCalledTimes(1);

    view.show(false);
    expect(watchers[0]?.disposed).toBe(true);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(tree.refresh).toHaveBeenCalledTimes(1);

    view.show(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(watchers).toHaveLength(2);
    follower.dispose();
    expect(watchers[1]?.disposed).toBe(true);
  });

  it("reads the runs again once for a burst of record events", async () => {
    const tree = { refresh: vi.fn(), refreshRuns: vi.fn() };
    followChangesView({ workspaceRoot: "/repo", view: viewFixture(true), tree, statusDirectory: async () => "/status" });
    await vi.advanceTimersByTimeAsync(0);

    watchers[0]?.fire();
    await vi.advanceTimersByTimeAsync(300);
    watchers[0]?.fire();
    watchers[0]?.fire();
    expect(tree.refreshRuns).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CHANGES_RECORDS_EVENT_WINDOW_MS);

    expect(tree.refreshRuns).toHaveBeenCalledTimes(1);
    expect(tree.refresh).not.toHaveBeenCalled();
  });

  it("makes no watcher where the directory cannot be resolved, and keeps the timer", async () => {
    const tree = { refresh: vi.fn(), refreshRuns: vi.fn() };
    followChangesView({ workspaceRoot: "/repo", view: viewFixture(true), tree, statusDirectory: async () => { throw new Error("not a git repository"); } });
    await vi.advanceTimersByTimeAsync(300_000);

    expect(watchers).toHaveLength(0);
    expect(tree.refresh).toHaveBeenCalledTimes(1);
  });
});
