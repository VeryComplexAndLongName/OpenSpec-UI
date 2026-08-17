import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const detectAvailableAgentsMock = vi.fn();
vi.mock("@openspec-ui/core", async () => {
    const actual = await vi.importActual<typeof import("@openspec-ui/core")>("@openspec-ui/core");
    return {
        ...actual,
        detectAvailableAgents: (...args: unknown[]) => detectAvailableAgentsMock(...args),
    };
});

const { AiPanel } = await import("./ai-panel.js");

beforeEach(() => {
    detectAvailableAgentsMock.mockResolvedValue({});
});

afterEach(() => {
    detectAvailableAgentsMock.mockReset();
});

function createPanelFixture() {
    const webview = {
        cspSource: "vscode-webview:",
        html: "",
        asWebviewUri: vi.fn((uri: { toString(): string }) => uri),
        postMessage: vi.fn(async () => true),
        onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
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
