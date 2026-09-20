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
  liveRuns?: { list: () => unknown[]; get?: (runId: string) => unknown };
  runChange?: (changeName: string) => Promise<void>;
  sendRunControl?: (control: unknown) => void;
  getLocalServerUrl?: () => string | undefined;
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
    lastRuns: vi.fn(async () => ({ byChange: { alpha: { runId: "c1", outcome: "failed", stage: "verify", endedAt: "2026-09-14T00:00:00.000Z" } } })),
    // Never the real ones: they read, or make, this machine's key under the
    // home directory (a-run-elsewhere-can-be-asked-to-stop).
    myLabel: vi.fn(async () => undefined),
    askLiveRun: vi.fn(async () => ({ asked: false, why: "not in this test" })),
    standings: vi.fn(async () => ({
      readAt: "2026-09-14T00:00:00.000Z",
      standings: [{ changeName: "alpha", elsewhere: [], main: { kind: "archived", archiveName: "2026-09-14-alpha" } }],
      sources: { fetch: { attempted: false }, pullRequests: { read: true } },
    })),
    drift: vi.fn(async (_root: string, standings: { standings: Array<{ changeName: string }> } | undefined) => ({
      branch: "main",
      defaultBranch: "main",
      remote: "origin",
      ahead: 0,
      behind: 4,
      archivedOnDefault: (standings?.standings ?? []).map((one) => one.changeName),
      clean: true,
    })),
    catchUp: vi.fn(async () => ({ ok: true, branch: "main", moved: 4 })),
    ...overrides.readers,
  };
  const revealChange = vi.fn(async () => undefined);
  const pipeline = new PipelinePanel({
    extensionUri: vscodeMock.Uri.file("/extension") as never,
    getWorkspaceRoot: () => "/repo",
    revealChange,
    readers: readers as never,
    ...(overrides.now ? { now: overrides.now } : {}),
    ...(overrides.liveRuns ? { liveRuns: overrides.liveRuns as never } : {}),
    ...(overrides.runChange ? { runChange: overrides.runChange } : {}),
    ...(overrides.sendRunControl ? { sendRunControl: overrides.sendRunControl } : {}),
    ...(overrides.getLocalServerUrl ? { getLocalServerUrl: overrides.getLocalServerUrl } : {}),
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

  // a-card-says-what-its-change-is-doing 4.4
  it("answers how each change's last run ended, against its own workspace root", async () => {
    const { pipeline, readers } = createPipelinePanel();
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "l:0", op: "pipeline/last-runs", args: { cwd: "/elsewhere" } });

    expect(readers.lastRuns).toHaveBeenCalledWith("/repo");
    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "l:0",
      ok: true,
      value: { byChange: { alpha: expect.objectContaining({ outcome: "failed", stage: "verify" }) } },
    }));
  });

  it("answers where each change stands, against its own workspace root", async () => {
    const { pipeline, readers } = createPipelinePanel();
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "w:0", op: "pipeline/standings", args: { cwd: "/elsewhere" } });

    expect(readers.standings).toHaveBeenCalledWith("/repo");
    // The interval reader, not the one Refresh uses: nothing is fetched now.
    expect(readers.standingsNow).not.toHaveBeenCalled();
    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "w:0",
      ok: true,
      value: expect.objectContaining({ standings: [expect.objectContaining({ changeName: "alpha" })] }),
    }));
  });

  // a-change-is-run-from-its-card 2.4
  it("answers the runs this host holds for its own root, and none without a registry", async () => {
    const held = (runId: string, cwd: string) => ({ runId, cwd, changeName: "alpha", kind: "chain", startedAt: "t", waiting: false, stopRequested: null });
    const { pipeline } = createPipelinePanel({ liveRuns: { list: () => [held("here", "/repo"), held("elsewhere", "/other")] } });
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "v:0", op: "pipeline/live-runs", args: { cwd: "/other" } });

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "v:0",
      ok: true,
      value: { runs: [expect.objectContaining({ runId: "here" })] },
    }));

    const bare = createPipelinePanel();
    bare.pipeline.show();
    await bare.pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "v:1", op: "pipeline/live-runs" });
    expect(created[1]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "v:1", ok: true, value: { runs: [] } }));
  });

  // a-run-elsewhere-can-be-asked-to-stop 3.3 and 3.6: a card's Stop on a run
  // held elsewhere is asked only of a run this host reads as live.
  it("asks a live run elsewhere to stop, refuses an unknown instance, and says which to the view", async () => {
    const { askLiveRunToStop } = await import("@openspec-ui/core");
    const ask = vi.fn(async () => "message-1");
    const askLiveRun = vi.fn((options: Parameters<typeof askLiveRunToStop>[0]) => askLiveRunToStop({
      ...options,
      // The real check, over records a test writes: run-b is live, nothing else.
      read: async () => ({ reports: [{ instanceId: "run-b", gone: false, signature: "verified" }] as never, malformed: [] }),
      ask,
      loadKey: async () => ({ keyId: "k" }) as never,
      readAuthor: async () => undefined,
      machine: "machine-a",
    }));
    const { pipeline } = createPipelinePanel({ readers: { askLiveRun } });
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/ask-to-stop", instanceId: "no-such-run", reason: "live check" });
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/ask-to-stop", instanceId: "run-b", reason: "live check" });
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/ask-to-stop", instanceId: "run-b", reason: "   " });

    const posted = created[0]!.webview.postMessage;
    expect(posted).toHaveBeenCalledWith(expect.objectContaining({
      type: "openspec-ui/ask-to-stop-result",
      instanceId: "no-such-run",
      asked: false,
      why: expect.stringContaining("no live run reports itself as no-such-run"),
    }));
    expect(posted).toHaveBeenCalledWith({ type: "openspec-ui/ask-to-stop-result", instanceId: "run-b", asked: true, messageId: "message-1" });
    // Asked once: the unknown instance and the blank reason wrote nothing.
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ to: "run-b", reason: "live check", machine: "machine-a" }));
    expect(askLiveRun).toHaveBeenCalledTimes(2);
  });

  it("answers the live runs with the label this host's key is enrolled under", async () => {
    const { pipeline } = createPipelinePanel({ readers: { myLabel: vi.fn(async () => "Ada") } });
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "m:0", op: "pipeline/live-runs" });

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "m:0", ok: true, value: { runs: [], myLabel: "Ada" } }));
  });

  // a-change-is-run-from-its-card 5.2
  it("opens the run dialog for a card's Start, only for an active change of its workspace", async () => {
    const runChange = vi.fn(async () => undefined);
    const { pipeline } = createPipelinePanel({ runChange });
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/run-change", changeName: "alpha" });
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/run-change", changeName: "gone" });
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/run-change", changeName: "../etc" });

    expect(runChange).toHaveBeenCalledTimes(1);
    expect(runChange).toHaveBeenCalledWith("alpha");
  });

  // a-change-is-run-from-its-card 5.4–5.6
  it("carries out a card's control only for a run this host holds, on the change the card names", async () => {
    const held = { runId: "r1", cwd: "/repo", changeName: "alpha", kind: "chain", startedAt: "t", waiting: true, permissionRequestId: "p1", stopRequested: null };
    const sendRunControl = vi.fn();
    const { pipeline } = createPipelinePanel({
      sendRunControl,
      liveRuns: { list: () => [held], get: (runId: string) => (runId === "r1" ? held : undefined) },
    });
    pipeline.show();
    const send = (control: Record<string, unknown>) => pipeline.deliverMessageForTesting({ type: "openspec-ui/run-control", control });

    await send({ changeName: "alpha", runId: "r1", kind: "stop", reason: "wrong branch" });
    await send({ changeName: "alpha", runId: "r1", kind: "resolvePermission", permissionRequestId: "p1", permissionOutcome: "deny" });
    // Refused: a run this host does not hold, another change, a stop with no
    // reason, and an answer with no outcome.
    await send({ changeName: "alpha", runId: "r2", kind: "cancel" });
    await send({ changeName: "beta", runId: "r1", kind: "cancel" });
    await send({ changeName: "alpha", runId: "r1", kind: "stop", reason: "   " });
    await send({ changeName: "alpha", runId: "r1", kind: "resolvePermission", permissionRequestId: "p1" });

    expect(sendRunControl.mock.calls).toEqual([
      [{ changeName: "alpha", runId: "r1", kind: "stop", reason: "wrong branch" }],
      [{ changeName: "alpha", runId: "r1", kind: "resolvePermission", permissionRequestId: "p1", permissionOutcome: "deny" }],
    ]);
  });

  it("ignores a control for a run this host holds in another workspace", async () => {
    const held = { runId: "r1", cwd: "/elsewhere", changeName: "alpha", kind: "chain", startedAt: "t", waiting: false, permissionRequestId: null, stopRequested: null };
    const sendRunControl = vi.fn();
    const { pipeline } = createPipelinePanel({ sendRunControl, liveRuns: { list: () => [held], get: () => held } });
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/run-control", control: { changeName: "alpha", runId: "r1", kind: "cancel" } });

    expect(sendRunControl).not.toHaveBeenCalled();
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

// the-pipeline-answers-while-a-run-works.
describe("PipelinePanel — the optional local server", () => {
  it("embeds the server's own Pipeline tab, under a CSP scoped to that address, and starts no watchers", () => {
    const { pipeline } = createPipelinePanel({ getLocalServerUrl: () => "http://127.0.0.1:4999/?token=abc" });

    pipeline.show();

    const html = created[0]!.webview.html;
    expect(html).toContain('<iframe src="http://127.0.0.1:4999/?token=abc&embed=vscode-local-server&tab=pipeline&theme=dark"');
    expect(html).toContain("frame-src http://127.0.0.1:4999/?token=abc;");
    expect(watchers).toHaveLength(0);
  });

  // 5.7, found live: the stylesheet that fills the tab with the iframe was
  // refused under `default-src 'none'`, leaving a 300 by 150 box.
  it("allows the stylesheet that fills the tab, by the document's nonce", () => {
    const { pipeline } = createPipelinePanel({ getLocalServerUrl: () => "http://127.0.0.1:4999/?token=abc" });

    pipeline.show();

    const html = created[0]!.webview.html;
    const nonce = /script-src 'nonce-([^']+)'/u.exec(html)?.[1];
    expect(nonce).toBeDefined();
    expect(html).toContain(`style-src 'nonce-${nonce}';`);
    expect(html).toContain(`<style nonce="${nonce}">html, body, iframe { height: 100%; width: 100%;`);
  });

  it("names the editor's light theme in the framed page's address, and draws it again when the theme changes", () => {
    vscodeMock.window.activeColorTheme = { kind: vscodeMock.ColorThemeKind.Light };
    const { pipeline } = createPipelinePanel({ getLocalServerUrl: () => "http://127.0.0.1:4999/?token=abc" });
    try {
      pipeline.show();
      expect(created[0]!.webview.html).toContain("&theme=light");

      vscodeMock.window.activeColorTheme = { kind: vscodeMock.ColorThemeKind.Dark };
      const onThemeChange = vscodeMock.window.onDidChangeActiveColorTheme.mock.calls.at(-1)?.[0];
      onThemeChange?.({ kind: vscodeMock.ColorThemeKind.Dark });
      expect(created[0]!.webview.html).toContain("&theme=dark");
    } finally {
      vscodeMock.window.activeColorTheme = { kind: vscodeMock.ColorThemeKind.Dark };
    }
  });

  it("renders today's bundle and bridge, unchanged, when no local server URL is given", () => {
    const { pipeline, readers } = createPipelinePanel({ getLocalServerUrl: () => undefined });

    pipeline.show();

    const html = created[0]!.webview.html;
    expect(html).toContain("pipeline.js");
    expect(html).not.toContain("<iframe");
    expect(readers.readiness).not.toHaveBeenCalled();
  });

  it("never starts the local server itself", () => {
    const getLocalServerUrl = vi.fn(() => "http://127.0.0.1:4999/");
    const { pipeline } = createPipelinePanel({ getLocalServerUrl });

    pipeline.show();

    // The dependency is only ever asked for the URL of a server already
    // running — nothing here starts one.
    expect(getLocalServerUrl).toHaveBeenCalled();
  });

  it("reveals an active change from the embedded page's own origin, the same as the bridge path", async () => {
    const { pipeline, revealChange } = createPipelinePanel({ getLocalServerUrl: () => "http://127.0.0.1:4999/" });
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/open-change", changeName: "alpha", origin: "http://127.0.0.1:4999" });

    expect(revealChange).toHaveBeenCalledWith(ACTIVE_CHANGE);
  });

  // 3.3: a message from another origin is ignored, and one from the
  // server's origin reaches revealChange.
  it("ignores an open-change message from any origin but the local server's own", async () => {
    const { pipeline, revealChange } = createPipelinePanel({ getLocalServerUrl: () => "http://127.0.0.1:4999/" });
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/open-change", changeName: "alpha", origin: "http://evil.example" });
    await pipeline.deliverMessageForTesting({ type: "openspec-ui/open-change", changeName: "alpha" });

    expect(revealChange).not.toHaveBeenCalled();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/open-change", changeName: "alpha", origin: "http://127.0.0.1:4999" });

    expect(revealChange).toHaveBeenCalledWith(ACTIVE_CHANGE);
  });

  it("carries the server's own origin into the outer document's relay script, for it to check before ever posting", () => {
    const { pipeline } = createPipelinePanel({ getLocalServerUrl: () => "http://127.0.0.1:4999/?token=abc" });

    pipeline.show();

    const html = created[0]!.webview.html;
    expect(html).toContain('event.origin !== "http://127.0.0.1:4999"');
    expect(html).toContain("acquireVsCodeApi()");
  });
});

// main-catches-up-with-what-landed 3.2: the panel answers the drift and
// the catch-up for its own host's root.
describe("PipelinePanel - how far behind this checkout is", () => {
  it("answers the drift, handing it the standings it read", async () => {
    const { pipeline } = createPipelinePanel();
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "w:9", op: "pipeline/drift" });

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "w:9",
      ok: true,
      value: expect.objectContaining({ behind: 4, archivedOnDefault: ["alpha"] }),
    }));
  });

  it("still answers the counts where the standings cannot be read", async () => {
    const { pipeline } = createPipelinePanel({
      readers: { standings: vi.fn(async () => { throw new Error("no gh here"); }) },
    });
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "w:10", op: "pipeline/drift" });

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "w:10",
      ok: true,
      value: expect.objectContaining({ behind: 4, archivedOnDefault: [] }),
    }));
  });

  it("answers the catch-up with what core said", async () => {
    const { pipeline } = createPipelinePanel();
    pipeline.show();

    await pipeline.deliverMessageForTesting({ type: "openspec-ui/request", id: "w:11", op: "pipeline/catch-up" });

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "w:11",
      ok: true,
      value: { ok: true, branch: "main", moved: 4 },
    }));
  });
});
