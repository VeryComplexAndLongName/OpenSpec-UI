import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();

/** A watcher whose events a test fires, and whose disposal it can see. As
 * VS Code's does, it delivers nothing once it, or the subscription, is
 * disposed. */
function createWatcherFixture(pattern: { base: unknown; pattern: string }) {
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

const vscodeWithWatchers = {
  ...vscodeMock,
  RelativePattern: class {
    constructor(public base: unknown, public pattern: string) { }
  },
  workspace: {
    ...vscodeMock.workspace,
    createFileSystemWatcher: vi.fn((pattern: { base: unknown; pattern: string }) => {
      const watcher = createWatcherFixture(pattern);
      watchers.push(watcher);
      return watcher;
    }),
  },
};
vi.mock("vscode", () => vscodeWithWatchers);

const { PipelinePanel, PIPELINE_EVENT_WINDOW_MS, PIPELINE_PANEL_TITLE } = await import("./pipeline-panel.js");

// the-pipeline-opens-in-vs-code. The same picture the standalone shell
// draws, in a panel of its own, told by file events when to read.

function createPanelFixture(title: string) {
  const messageListeners: Array<(message: unknown) => void> = [];
  const disposeListeners: Array<() => void> = [];
  const viewStateListeners: Array<(event: { webviewPanel: { visible: boolean } }) => void> = [];
  return {
    title,
    visible: true,
    webview: {
      cspSource: "vscode-webview:",
      html: "",
      asWebviewUri: vi.fn((uri: { toString(): string }) => uri),
      postMessage: vi.fn(async () => true),
      onDidReceiveMessage: vi.fn((listener: (message: unknown) => void) => {
        messageListeners.push(listener);
        return { dispose: vi.fn() };
      }),
    },
    reveal: vi.fn(),
    onDidDispose: vi.fn((listener: () => void) => {
      disposeListeners.push(listener);
      return { dispose: vi.fn() };
    }),
    onDidChangeViewState: vi.fn((listener: (event: { webviewPanel: { visible: boolean } }) => void) => {
      viewStateListeners.push(listener);
      return { dispose: vi.fn() };
    }),
    setVisible(visible: boolean) {
      this.visible = visible;
      for (const listener of viewStateListeners) listener({ webviewPanel: { visible } });
    },
    dispose: () => { for (const listener of disposeListeners) listener(); },
  };
}

let created: Array<ReturnType<typeof createPanelFixture>> = [];

beforeEach(() => {
  created = [];
  watchers = [];
  vscodeMock.window.createWebviewPanel.mockImplementation((_viewType: string, title: string) => {
    const panel = createPanelFixture(title);
    created.push(panel);
    return panel;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vscodeMock.window.createWebviewPanel.mockReset();
  vscodeMock.window.showInformationMessage.mockReset();
  vscodeMock.window.showTextDocument.mockClear();
  vscodeMock.workspace.openTextDocument.mockClear();
});

const ACTIVE_CHANGE = { name: "alpha", path: "/repo/openspec/changes/alpha", state: "draft", artifacts: [] };

function createPipelinePanel(overrides: {
  readers?: Record<string, unknown>;
  statusDirectory?: () => Promise<string>;
  now?: () => number;
} = {}) {
  const readers = {
    readiness: vi.fn(async () => ({ changes: [] })),
    survey: vi.fn(async () => ({ directories: [], runsElsewhere: [] })),
    refreshRuns: vi.fn(async (survey: unknown) => survey),
    statusDirectory: vi.fn(overrides.statusDirectory ?? (async () => "/wt/repo/.agent-status")),
    findActiveChange: vi.fn(async (_root: string, name: string) => (name === "alpha" ? ACTIVE_CHANGE : undefined)),
    standingsNow: vi.fn(async () => ({
      readAt: "2026-09-14T00:00:00.000Z",
      standings: [],
      sources: {
        mainRef: "origin/main",
        lastFetchedAt: "2026-09-14T00:00:00.000Z",
        fetch: { attempted: true, at: "2026-09-14T00:00:00.000Z" },
        pullRequests: { read: true },
      },
    })),
    ...overrides.readers,
  };
  const revealChange = vi.fn(async () => undefined);
  const pipeline = new PipelinePanel({
    extensionUri: vscodeMock.Uri.file("/extension") as never,
    getWorkspaceRoot: () => "/repo",
    revealChange,
    readers: readers as never,
    ...(overrides.now ? { now: overrides.now } : {}),
  });
  return { pipeline, readers, revealChange };
}

async function settled() {
  for (let turn = 0; turn < 6; turn += 1) await Promise.resolve();
}

const changedMessages = (panel: ReturnType<typeof createPanelFixture>) =>
  panel.webview.postMessage.mock.calls
    .map((call) => (call as unknown[])[0] as { type?: string; readings?: string[] })
    .filter((message) => message.type === "openspec-ui/pipeline-changed");

describe("PipelinePanel — one panel", () => {
  it("opens one panel per window, titled, and reveals it rather than opening another", () => {
    const { pipeline } = createPipelinePanel();

    pipeline.show();
    pipeline.show();

    expect(created).toHaveLength(1);
    expect(created[0]!.title).toBe(PIPELINE_PANEL_TITLE);
    expect(created[0]!.reveal).toHaveBeenCalledOnce();
  });

  it("renders its own bundle under a script policy with no inline scripts", () => {
    const { pipeline } = createPipelinePanel();
    pipeline.show();

    const html = created[0]!.webview.html;
    expect(html).toContain("pipeline.js");
    expect(html).toContain("script-src vscode-webview:;");
    expect(html).not.toContain("'unsafe-inline'; style");
  });
});

describe("PipelinePanel — answering the view", () => {
  it("answers each reading against its own workspace root", async () => {
    const { pipeline, readers } = createPipelinePanel();
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "r:0", op: "pipeline/readiness" });
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "s:1", op: "pipeline/survey", args: { cwd: "/elsewhere" } });

    expect(readers.readiness).toHaveBeenCalledWith("/repo");
    expect(readers.survey).toHaveBeenCalledWith("/repo");
    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "r:0", ok: true }));
    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "s:1", ok: true }));
  });

  it("refuses an operation it does not offer, by name", async () => {
    const { pipeline } = createPipelinePanel();
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "x:2", op: "harness/write-global" });

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "x:2",
      ok: false,
      error: expect.stringContaining("unknown operation"),
    }));
  });

  it("re-reads only the runs when only status records changed since a recent survey", async () => {
    vi.useFakeTimers();
    let clock = 0;
    const { pipeline, readers } = createPipelinePanel({ now: () => clock });
    pipeline.show();
    await settled();
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "s:0", op: "pipeline/survey" });

    watchers.find((watcher) => watcher.pattern.pattern === "*.json")!.fire();
    clock = 10_000;
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "s:1", op: "pipeline/survey" });

    expect(readers.survey).toHaveBeenCalledTimes(1);
    expect(readers.refreshRuns).toHaveBeenCalledTimes(1);

    // A change under openspec/changes means the directories' own contents
    // changed, which only a full survey reads.
    watchers.find((watcher) => watcher.pattern.pattern === "openspec/changes/**")!.fire();
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "s:2", op: "pipeline/survey" });
    expect(readers.survey).toHaveBeenCalledTimes(2);
  });

  // a-change-says-where-it-stands 4.5
  it("fetches refs now on Refresh, says how fresh they are, and takes the next survey afresh", async () => {
    let clock = 0;
    const { pipeline, readers } = createPipelinePanel({ now: () => clock });
    pipeline.show();
    await settled();
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "s:0", op: "pipeline/survey" });

    // Only records changed, which would otherwise reuse the survey held.
    watchers.find((watcher) => watcher.pattern.pattern === "*.json")!.fire();
    clock = 10_000;
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "f:1", op: "pipeline/refresh" });
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "s:2", op: "pipeline/survey" });

    expect(readers.standingsNow).toHaveBeenCalledWith("/repo");
    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "f:1",
      ok: true,
      value: expect.stringContaining("Main read from origin/main."),
    }));
    expect(readers.survey).toHaveBeenCalledTimes(2);
    expect(readers.refreshRuns).not.toHaveBeenCalled();
  });
});

describe("PipelinePanel — file events", () => {
  it("posts one message naming both readings for two changes within a second", async () => {
    vi.useFakeTimers();
    const { pipeline } = createPipelinePanel();
    pipeline.show();
    await settled();
    const changes = watchers.find((watcher) => watcher.pattern.pattern === "openspec/changes/**")!;

    changes.fire();
    await vi.advanceTimersByTimeAsync(400);
    changes.fire();
    await vi.advanceTimersByTimeAsync(PIPELINE_EVENT_WINDOW_MS);

    expect(changedMessages(created[0]!)).toEqual([
      { type: "openspec-ui/pipeline-changed", readings: ["readiness", "survey"] },
    ]);
  });

  it("posts one message naming the survey for a status record event", async () => {
    vi.useFakeTimers();
    const { pipeline } = createPipelinePanel();
    pipeline.show();
    await settled();
    const records = watchers.find((watcher) => watcher.pattern.pattern === "*.json")!;

    records.fire();
    records.fire();
    await vi.advanceTimersByTimeAsync(PIPELINE_EVENT_WINDOW_MS);

    expect(changedMessages(created[0]!)).toEqual([{ type: "openspec-ui/pipeline-changed", readings: ["survey"] }]);
  });

  it("posts nothing once the panel is hidden, and disposes its watchers", async () => {
    vi.useFakeTimers();
    const { pipeline } = createPipelinePanel();
    pipeline.show();
    await settled();
    const watching = [...watchers];

    created[0]!.setVisible(false);
    for (const watcher of watching) watcher.fire();
    await vi.advanceTimersByTimeAsync(PIPELINE_EVENT_WINDOW_MS * 3);

    expect(watching.every((watcher) => watcher.disposed)).toBe(true);
    expect(changedMessages(created[0]!)).toEqual([]);
  });

  it("watches the changes alone where the status directory cannot be resolved", async () => {
    const { pipeline } = createPipelinePanel({ statusDirectory: async () => { throw new Error("not a git repository"); } });
    pipeline.show();
    await settled();

    expect(watchers.map((watcher) => watcher.pattern.pattern)).toEqual(["openspec/changes/**"]);
  });
});

describe("PipelinePanel — opening a change", () => {
  it("reveals an active change in the Changes tree and opens its proposal", async () => {
    const { pipeline, revealChange } = createPipelinePanel();
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/open-change", changeName: "alpha" });

    expect(revealChange).toHaveBeenCalledWith(ACTIVE_CHANGE);
    const opened = vscodeMock.workspace.openTextDocument.mock.calls[0]?.[0] as { fsPath: string } | undefined;
    expect(opened?.fsPath.replaceAll("\\", "/")).toBe("/repo/openspec/changes/alpha/proposal.md");
    expect(vscodeMock.window.showTextDocument).toHaveBeenCalledOnce();
  });

  it("opens nothing for a name that is not an active change, and says so", async () => {
    const { pipeline, revealChange } = createPipelinePanel();
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/open-change", changeName: "gone-already" });

    expect(revealChange).not.toHaveBeenCalled();
    expect(vscodeMock.workspace.openTextDocument).not.toHaveBeenCalled();
    expect(vscodeMock.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining("gone-already is not an active change"));
  });

  it("refuses a name containing a path separator before looking anything up", async () => {
    const { pipeline, readers, revealChange } = createPipelinePanel();
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/open-change", changeName: "../../etc" });

    expect(readers.findActiveChange).not.toHaveBeenCalled();
    expect(revealChange).not.toHaveBeenCalled();
    expect(vscodeMock.workspace.openTextDocument).not.toHaveBeenCalled();
    expect(vscodeMock.window.showInformationMessage).toHaveBeenCalledOnce();
  });
});
