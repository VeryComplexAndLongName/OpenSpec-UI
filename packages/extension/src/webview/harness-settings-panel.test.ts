import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const resolveHarnessConfigMock = vi.fn();
vi.mock("@openspec-ui/core", async () => {
  const actual = await vi.importActual<typeof import("@openspec-ui/core")>("@openspec-ui/core");
  return {
    ...actual,
    resolveHarnessConfig: (...args: unknown[]) => resolveHarnessConfigMock(...args),
  };
});

const { HarnessSettingsPanel, GLOBAL_HARNESS_PANEL_TITLE } = await import("./harness-settings-panel.js");

// a-change-is-configured-from-the-change. The settings view was mounted in
// the AI panel, and a panel opened from a change learned the change's name
// after the view mounted, so nothing was loaded. Each file now has a panel
// of its own, and the name is in the page it is rendered with.

function createPanelFixture(title: string) {
  const messageListeners: Array<(message: unknown) => void> = [];
  const disposeListeners: Array<() => void> = [];
  return {
    title,
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
    deliver: (message: unknown) => { for (const listener of messageListeners) listener(message); },
    dispose: () => { for (const listener of disposeListeners) listener(); },
  };
}

let created: Array<ReturnType<typeof createPanelFixture>> = [];

beforeEach(() => {
  created = [];
  vscodeMock.window.createWebviewPanel.mockImplementation((_viewType: string, title: string) => {
    const panel = createPanelFixture(title);
    created.push(panel);
    return panel;
  });
  resolveHarnessConfigMock.mockResolvedValue({ stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } });
});

afterEach(() => {
  vscodeMock.window.createWebviewPanel.mockReset();
  resolveHarnessConfigMock.mockReset();
});

/** `null` stands for "no workspace is open": an explicit `undefined`
 * argument would take the default instead, and the test that means to
 * have no root would read one. */
function createSettingsPanel(root: string | null = "/repo") {
  return new HarnessSettingsPanel({
    extensionUri: vscodeMock.Uri.file("/extension") as never,
    getWorkspaceRoot: () => root ?? undefined,
  });
}

async function settled() {
  // The handler replies after awaits; a few turns of the microtask queue
  // are enough and do not depend on timing.
  for (let turn = 0; turn < 6; turn += 1) await Promise.resolve();
}

describe("HarnessSettingsPanel — a panel of its own", () => {
  it("opens one global panel, titled, and reveals it rather than opening another", () => {
    const settings = createSettingsPanel();

    settings.showGlobal();
    settings.showGlobal();

    expect(created).toHaveLength(1);
    expect(created[0]!.title).toBe(GLOBAL_HARNESS_PANEL_TITLE);
    expect(created[0]!.reveal).toHaveBeenCalledOnce();
  });

  it("opens one panel per change, titled with the change's name", () => {
    const settings = createSettingsPanel();

    settings.showChange("first");
    settings.showChange("first");
    settings.showChange("second");

    expect(created.map((panel) => panel.title)).toEqual(["Harness: first", "Harness: second"]);
    expect(created[0]!.reveal).toHaveBeenCalledOnce();
    expect(settings.countForTesting()).toBe(2);
  });

  it("opens a change's panel again after it was closed", () => {
    const settings = createSettingsPanel();
    settings.showChange("first");

    created[0]!.dispose();
    settings.showChange("first");

    expect(created).toHaveLength(2);
  });

  it("renders the change's name into the page, so the view has it on its first render", () => {
    const settings = createSettingsPanel();

    settings.showChange("a&change");

    const html = created[0]!.webview.html;
    expect(html).toContain('data-scope="change"');
    expect(html).toContain('data-change-name="a&amp;change"');
    expect(html).toContain("harness-settings.js");
    // A script CSP without 'unsafe-inline': the page runs only its bundle.
    expect(html).toContain("script-src vscode-webview:;");
    expect(html).not.toContain("script-src vscode-webview: 'unsafe-inline'");
    // The icons are a data: font inside the stylesheet; without this the
    // gear beside "Global harness settings" is an empty box
    // (an-editor-panel-draws-its-icons).
    expect(html).toContain("font-src data:;");
  });

  it("renders the global panel with the global scope and no change", () => {
    const settings = createSettingsPanel();

    settings.showGlobal();

    expect(created[0]!.webview.html).toContain('data-scope="global"');
    expect(created[0]!.webview.html).toContain('data-change-name=""');
  });

  it("opens the global panel when a change's panel asks for the global defaults", () => {
    const settings = createSettingsPanel();
    settings.showChange("first");

    created[0]!.deliver({ type: "openspec-ui/edit-global-harness" });

    expect(created.map((panel) => panel.title)).toEqual(["Harness: first", GLOBAL_HARNESS_PANEL_TITLE]);
  });
});

describe("HarnessSettingsPanel — answering what the webview asks", () => {
  // harness-settings-in-the-panel, moved here with the settings view.

  it("answers with the resolved configuration, against the request's id", async () => {
    const settings = createSettingsPanel();
    settings.showGlobal();

    created[0]!.deliver({ type: "openspec-ui/request", id: "harness/resolve-global:0", op: "harness/resolve-global" });
    await settled();

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "openspec-ui/response",
      id: "harness/resolve-global:0",
      ok: true,
      value: expect.objectContaining({ autonomyLevel: "assisted" }),
    }));
  });

  it("refuses an operation it does not offer, by name", async () => {
    // A request that vanishes leaves a promise that never settles, which
    // is worse for the form than an error.
    const settings = createSettingsPanel();
    settings.showGlobal();

    created[0]!.deliver({ type: "openspec-ui/request", id: "x:1", op: "read-any-file-you-like" });
    await settled();

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "x:1",
      ok: false,
      error: expect.stringContaining("unknown operation"),
    }));
  });

  it("carries a refusal from core back as the error", async () => {
    resolveHarnessConfigMock.mockRejectedValue(new Error("agent-harness.json is not valid JSON"));
    const settings = createSettingsPanel();
    settings.showGlobal();

    created[0]!.deliver({ type: "openspec-ui/request", id: "y:2", op: "harness/resolve-global" });
    await settled();

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "y:2",
      ok: false,
      error: "agent-harness.json is not valid JSON",
    }));
  });

  it("refuses a per-change request that names no change", async () => {
    const settings = createSettingsPanel();
    settings.showChange("demo");

    created[0]!.deliver({ type: "openspec-ui/request", id: "z:3", op: "harness/read-change-override" });
    await settled();

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "z:3",
      ok: false,
      error: expect.stringContaining("no change"),
    }));
  });

  it("refuses a change name that would write outside the workspace, and says why", async () => {
    // a-name-is-checked-before-it-is-used. The refusal comes from core, so
    // the bridge only has to carry it.
    const settings = createSettingsPanel();
    settings.showChange("demo");

    created[0]!.deliver({
      type: "openspec-ui/request",
      id: "z:4",
      op: "harness/write-change-override",
      args: { changeName: "../../../../escaped", config: { autonomyLevel: "assisted" } },
    });
    await settled();

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "z:4",
      ok: false,
      error: expect.stringContaining("Invalid OpenSpec change name"),
    }));
  });

  it("refuses the same name on the read side, so both directions agree", async () => {
    const settings = createSettingsPanel();
    settings.showChange("demo");

    created[0]!.deliver({
      type: "openspec-ui/request",
      id: "z:5",
      op: "harness/read-change-override",
      args: { changeName: "../../../../escaped" },
    });
    await settled();

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "z:5",
      ok: false,
      error: expect.stringContaining("Invalid OpenSpec change name"),
    }));
  });

  it("says no workspace is open rather than reading against nothing", async () => {
    const settings = createSettingsPanel(null);
    settings.showGlobal();

    created[0]!.deliver({ type: "openspec-ui/request", id: "w:6", op: "harness/resolve-global" });
    await settled();

    expect(created[0]!.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "w:6",
      ok: false,
      error: "no workspace root is open",
    }));
  });

  it("lets a test observe the requests a change's panel sends, with the change it belongs to", async () => {
    const settings = createSettingsPanel();
    const seen: unknown[] = [];
    settings.onRequestForTesting((request) => seen.push(request));
    settings.showChange("demo");

    created[0]!.deliver({ type: "openspec-ui/request", id: "r:7", op: "harness/read-change-override", args: { changeName: "demo" } });
    await settled();

    expect(seen).toEqual([{ changeName: "demo", op: "harness/read-change-override", args: { changeName: "demo" } }]);
  });
});
