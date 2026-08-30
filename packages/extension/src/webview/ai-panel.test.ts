import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const detectAvailableAgentsMock = vi.fn();
const resolveHarnessConfigMock = vi.fn();
vi.mock("@openspec-ui/core", async () => {
    const actual = await vi.importActual<typeof import("@openspec-ui/core")>("@openspec-ui/core");
    return {
        ...actual,
        detectAvailableAgents: (...args: unknown[]) => detectAvailableAgentsMock(...args),
        resolveHarnessConfig: (...args: unknown[]) => resolveHarnessConfigMock(...args),
    };
});

const { AiPanel } = await import("./ai-panel.js");

beforeEach(() => {
    detectAvailableAgentsMock.mockResolvedValue({});
    resolveHarnessConfigMock.mockResolvedValue({
        stepAgents: {},
        autonomyLevel: "assisted",
        reviewGate: { mode: "human-required" },
    });
});

afterEach(() => {
    detectAvailableAgentsMock.mockReset();
    resolveHarnessConfigMock.mockReset();
});

function createPanelFixture() {
    const webview = {
        cspSource: "vscode-webview:",
        html: "",
        asWebviewUri: vi.fn((uri: { toString(): string }) => uri),
        postMessage: vi.fn(async () => true),
        onDidReceiveMessage: vi.fn((_listener: (message: unknown) => void) => ({ dispose: vi.fn() })),
    };
    const panel = {
        webview,
        reveal: vi.fn(),
        onDidDispose: vi.fn(),
    };
    vscodeMock.window.createWebviewPanel.mockReturnValue(panel);
    return panel;
}

function createAiPanel(options: { getLocalServerUrl?: () => string | undefined } = {}) {
    return new AiPanel({
        extensionUri: vscodeMock.Uri.file("/extension") as never,
        runController: {
            onEvent: vi.fn(() => vi.fn()),
            run: vi.fn(),
        } as never,
        resolveRunner: () => undefined,
        getLocalServerUrl: options.getLocalServerUrl ?? (() => undefined),
    });
}

describe("AiPanel context", () => {
    it("bootstraps escaped workspace and change paths", () => {
        const panel = createPanelFixture();
        const aiPanel = createAiPanel();

        aiPanel.reveal({ cwd: 'C:\\repo&"work', changeDir: "C:\\repo\\openspec\\changes" });

        expect(panel.webview.html).toContain('data-workspace-root="C:\\repo&amp;&quot;work"');
        expect(panel.webview.html).toContain('data-change-directory="C:\\repo\\openspec\\changes"');
    });

    it("updates context when an existing panel is revealed", () => {
        const panel = createPanelFixture();
        const aiPanel = createAiPanel();
        aiPanel.reveal({ cwd: "/one", changeDir: "/one/openspec/changes" });

        aiPanel.reveal({ cwd: "/two", changeDir: "/two/openspec/changes/demo" });

        expect(panel.reveal).toHaveBeenCalled();
        expect(panel.webview.postMessage).toHaveBeenCalledWith({
            type: "openspec-ui/context",
            context: { cwd: "/two", changeDir: "/two/openspec/changes/demo" },
        });
    });

    it("posts a follow-up context message with detection results once resolved, without blocking reveal", async () => {
        let resolveDetection: (value: Record<string, boolean>) => void = () => {};
        detectAvailableAgentsMock.mockReturnValue(
            new Promise((resolve) => {
                resolveDetection = resolve;
            }),
        );
        // Held back too, so its own follow-up context message (tested
        // separately below) doesn't interleave with this test's assertions.
        resolveHarnessConfigMock.mockReturnValue(new Promise(() => {}));
        const panel = createPanelFixture();
        const aiPanel = createAiPanel();

        aiPanel.reveal({ cwd: "/repo", changeDir: "/repo/openspec/changes" });

        // First-ever reveal creates the panel and embeds context via HTML
        // data attributes (see getBridgeHtml), not postMessage — detection
        // has not resolved yet, so no postMessage should have gone out.
        expect(panel.webview.postMessage).not.toHaveBeenCalled();

        resolveDetection({ "claude-cli": true, "copilot-cli": false });
        await Promise.resolve();
        await Promise.resolve();

        expect(panel.webview.postMessage).toHaveBeenCalledWith({
            type: "openspec-ui/context",
            context: {
                cwd: "/repo",
                changeDir: "/repo/openspec/changes",
                detectedAgents: { "claude-cli": true, "copilot-cli": false },
            },
        });
        expect(aiPanel.getContext()?.detectedAgents).toEqual({ "claude-cli": true, "copilot-cli": false });
    });

    it("re-detects on every reveal of an already-open panel", async () => {
        detectAvailableAgentsMock.mockResolvedValue({ "claude-cli": true });
        createPanelFixture();
        const aiPanel = createAiPanel();
        aiPanel.reveal({ cwd: "/repo", changeDir: "/repo/openspec/changes" });
        await Promise.resolve();
        await Promise.resolve();
        detectAvailableAgentsMock.mockClear();

        aiPanel.reveal({ cwd: "/repo", changeDir: "/repo/openspec/changes" });

        expect(detectAvailableAgentsMock).toHaveBeenCalledTimes(1);
    });

    it("does not run detection in optional-local-server mode", () => {
        createPanelFixture();
        const aiPanel = createAiPanel({ getLocalServerUrl: () => "http://127.0.0.1:4317/#token=abc" });

        aiPanel.reveal({ cwd: "/repo", changeDir: "/repo/openspec/changes" });

        expect(detectAvailableAgentsMock).not.toHaveBeenCalled();
    });
});

describe("AiPanel Agentic Harness stepAgents context", () => {
    it("posts a follow-up context message with the resolved propose/review/apply agents once resolved", async () => {
        resolveHarnessConfigMock.mockResolvedValue({
            stepAgents: { propose: "claude-cli", apply: "gemini-cli", archive: "codex-cli", git: "claude-cli" },
            autonomyLevel: "assisted",
            reviewGate: { mode: "human-required" },
        });
        // Held back so its own follow-up context message doesn't interleave
        // with this test's assertions (see the reverse case above).
        detectAvailableAgentsMock.mockReturnValue(new Promise(() => {}));
        const panel = createPanelFixture();
        const aiPanel = createAiPanel();

        aiPanel.reveal({ cwd: "/repo", changeDir: "/repo/openspec/changes/demo" });
        await Promise.resolve();
        await Promise.resolve();

        expect(resolveHarnessConfigMock).toHaveBeenCalledWith("/repo", "demo");
        expect(panel.webview.postMessage).toHaveBeenCalledWith({
            type: "openspec-ui/context",
            context: {
                cwd: "/repo",
                changeDir: "/repo/openspec/changes/demo",
                stepAgents: { propose: "claude-cli", review: undefined, apply: "gemini-cli" },
            },
        });
        expect(aiPanel.getContext()?.stepAgents).toEqual({ propose: "claude-cli", review: undefined, apply: "gemini-cli" });
    });

    it("does not resolve harness config in optional-local-server mode", () => {
        createPanelFixture();
        const aiPanel = createAiPanel({ getLocalServerUrl: () => "http://127.0.0.1:4317/#token=abc" });

        aiPanel.reveal({ cwd: "/repo", changeDir: "/repo/openspec/changes" });

        expect(resolveHarnessConfigMock).not.toHaveBeenCalled();
    });

    it("does not throw when a malformed harness config rejects resolution", async () => {
        resolveHarnessConfigMock.mockRejectedValue(new Error("Invalid harness config"));
        const panel = createPanelFixture();
        const aiPanel = createAiPanel();

        aiPanel.reveal({ cwd: "/repo", changeDir: "/repo/openspec/changes/demo" });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(aiPanel.getContext()?.stepAgents).toBeUndefined();
        expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
            expect.objectContaining({ context: expect.objectContaining({ stepAgents: expect.anything() }) }),
        );
    });
});

describe("AiPanel local-server embed", () => {
    it("marks the iframe src with the VS Code local-server embed signal, ahead of the token fragment", () => {
        const panel = createPanelFixture();
        const aiPanel = createAiPanel({ getLocalServerUrl: () => "http://127.0.0.1:4317/#token=abc123" });

        aiPanel.reveal();

        expect(panel.webview.html).toContain(
            'src="http://127.0.0.1:4317/?embed=vscode-local-server#token=abc123"',
        );
    });

    it("uses the message-bridge HTML (no iframe) when no local server is running", () => {
        const panel = createPanelFixture();
        const aiPanel = createAiPanel();

        aiPanel.reveal();

        expect(panel.webview.html).not.toContain("<iframe");
    });
});

describe("AiPanel harness process tracking", () => {
    function createHarnessFixture() {
        const eventListeners: Array<(event: unknown) => void> = [];
        const runController = {
            onEvent: vi.fn((listener: (event: unknown) => void) => {
                eventListeners.push(listener);
                return vi.fn();
            }),
            run: vi.fn(),
        };
        const scheduleHandle = { id: "p1", completion: Promise.resolve(), cancel: vi.fn() };
        const scheduler = {
            start: vi.fn((_options: {
                operation: string;
                changeName?: string;
                agentId?: string;
                mutating: boolean;
                execute: (ctx: { report: (message: string) => void; signal: AbortSignal }) => Promise<string | void>;
            }) => scheduleHandle),
        };
        const panel = createPanelFixture();
        const aiPanel = new AiPanel({
            extensionUri: vscodeMock.Uri.file("/extension") as never,
            runController: runController as never,
            resolveRunner: () => ({ name: "claude-cli", run: vi.fn() }) as never,
            getLocalServerUrl: () => undefined,
            scheduler: scheduler as never,
        });
        aiPanel.reveal();

        const receiveMessage = panel.webview.onDidReceiveMessage.mock.calls[0]?.[0] as (message: unknown) => void;
        const emit = (event: unknown) => eventListeners.forEach((listener) => listener(event));
        return { panel, runController, scheduler, scheduleHandle, receiveMessage, emit };
    }

    function sendImplementCommand(receiveMessage: (message: unknown) => void) {
        receiveMessage({
            type: "openspec-ui/command",
            command: {
                kind: "implement",
                cwd: "/repo",
                context: { changeDir: "/repo/openspec/changes/demo" },
                runId: "run-1",
                agentId: "claude-cli",
            },
        });
    }

    it("registers a WorkbenchProcess with the resolved agentId and changeName", () => {
        const { scheduler, receiveMessage } = createHarnessFixture();

        sendImplementCommand(receiveMessage);

        expect(scheduler.start).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: "implement",
                changeName: "demo",
                agentId: "claude-cli",
                mutating: true,
            }),
        );
    });

    it("does not register a process when no scheduler is supplied", () => {
        const panel = createPanelFixture();
        const runController = { onEvent: vi.fn(() => vi.fn()), run: vi.fn() };
        const aiPanel = new AiPanel({
            extensionUri: vscodeMock.Uri.file("/extension") as never,
            runController: runController as never,
            resolveRunner: () => ({ name: "claude-cli", run: vi.fn() }) as never,
            getLocalServerUrl: () => undefined,
        });
        aiPanel.reveal();
        const receiveMessage = panel.webview.onDidReceiveMessage.mock.calls[0]?.[0] as (message: unknown) => void;

        expect(() => sendImplementCommand(receiveMessage)).not.toThrow();
    });

    it("resolves the tracked process's execute() when the run completes", async () => {
        const { scheduler, receiveMessage, emit } = createHarnessFixture();
        sendImplementCommand(receiveMessage);
        const execute = scheduler.start.mock.calls[0]?.[0].execute as (ctx: { report: (message: string) => void; signal: AbortSignal }) => Promise<string | void>;

        const report = vi.fn();
        const resultPromise = execute({ report, signal: new AbortController().signal });
        emit({ kind: "progress", runId: "run-1", message: "halfway" });
        emit({ kind: "completed", runId: "run-1", summary: "done" });

        await expect(resultPromise).resolves.toBe("done");
        expect(report).toHaveBeenCalledWith("halfway");
    });

    it("rejects the tracked process's execute() when the run fails", async () => {
        const { scheduler, receiveMessage, emit } = createHarnessFixture();
        sendImplementCommand(receiveMessage);
        const execute = scheduler.start.mock.calls[0]?.[0].execute as (ctx: { report: (message: string) => void; signal: AbortSignal }) => Promise<string | void>;

        const resultPromise = execute({ report: vi.fn(), signal: new AbortController().signal });
        emit({ kind: "failed", runId: "run-1", reason: "boom" });

        await expect(resultPromise).rejects.toThrow("boom");
    });

    it("cancels the scheduler handle and resolves when the run is cancelled", async () => {
        const { scheduler, scheduleHandle, receiveMessage, emit } = createHarnessFixture();
        sendImplementCommand(receiveMessage);
        const execute = scheduler.start.mock.calls[0]?.[0].execute as (ctx: { report: (message: string) => void; signal: AbortSignal }) => Promise<string | void>;

        const resultPromise = execute({ report: vi.fn(), signal: new AbortController().signal });
        emit({ kind: "cancelled", runId: "run-1" });

        await resultPromise;
        expect(scheduleHandle.cancel).toHaveBeenCalled();
    });

    it("ignores events from a different runId", async () => {
        const { scheduler, receiveMessage, emit } = createHarnessFixture();
        sendImplementCommand(receiveMessage);
        const execute = scheduler.start.mock.calls[0]?.[0].execute as (ctx: { report: (message: string) => void; signal: AbortSignal }) => Promise<string | void>;

        let settled = false;
        const resultPromise = execute({ report: vi.fn(), signal: new AbortController().signal }).then(() => {
            settled = true;
        });
        emit({ kind: "completed", runId: "some-other-run", summary: "not mine" });
        await Promise.resolve();

        expect(settled).toBe(false);
        emit({ kind: "completed", runId: "run-1", summary: "mine" });
        await resultPromise;
        expect(settled).toBe(true);
    });
});
