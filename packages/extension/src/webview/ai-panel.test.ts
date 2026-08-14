import { describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const { AiPanel } = await import("./ai-panel.js");

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
