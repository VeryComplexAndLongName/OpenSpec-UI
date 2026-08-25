// 2.2 Message bridge between the extension host and the webview (primary mode).
// 2.3 If the local server is enabled — the webview loads the same browser
// shell as standalone instead of using the bridge (see design.md, "Optional
// local server reuses the same server package as standalone").

import * as vscode from "vscode";
import { detectAvailableAgents, type AgentRunner } from "@openspec-ui/core";
import type { RunController } from "../run-controller.js";

const COMMAND_MESSAGE_TYPE = "openspec-ui/command";
const EVENT_MESSAGE_TYPE = "openspec-ui/event";
const CONTEXT_MESSAGE_TYPE = "openspec-ui/context";

export interface AiPanelContext {
  cwd: string;
  changeDir: string;
  /** Never set by a caller of `reveal()` — populated internally, after the
   * fact, once `detectAvailableAgents()` resolves (see design.md, "Extension:
   * detection runs after reveal(), posted as a follow-up context message"). */
  detectedAgents?: Record<string, boolean>;
}

interface BridgeCommandMessage {
  type: typeof COMMAND_MESSAGE_TYPE;
  command: Parameters<AgentRunner["run"]>[0];
}

function isBridgeCommandMessage(data: unknown): data is BridgeCommandMessage {
  if (typeof data !== "object" || data === null) return false;
  const v = data as Record<string, unknown>;
  return v.type === COMMAND_MESSAGE_TYPE && typeof v.command === "object" && v.command !== null;
}

export interface AiPanelDeps {
  extensionUri: vscode.Uri;
  runController: RunController;
  resolveRunner: (agentId: string | undefined) => AgentRunner | undefined;
  /** If the local server is enabled and running — returns its base URL
   * (`http://127.0.0.1:<port>`); otherwise `undefined` (primary mode uses
   * the bridge). */
  getLocalServerUrl: () => string | undefined;
}

export class AiPanel {
  private panel: vscode.WebviewPanel | undefined;
  private panelContext: AiPanelContext | undefined;

  constructor(private readonly deps: AiPanelDeps) { }

  reveal(panelContext?: AiPanelContext): void {
    if (panelContext) this.panelContext = { ...panelContext };
    if (this.panel) {
      this.panel.reveal();
      if (panelContext) {
        void this.panel.webview.postMessage({ type: CONTEXT_MESSAGE_TYPE, context: panelContext });
      }
      this.detectAndPostAgents();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "openspecUiAiPanel",
      "OpenSpec UI",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.deps.extensionUri, "dist")],
      },
    );
    this.panel = panel;

    const localServerUrl = this.deps.getLocalServerUrl();
    panel.webview.html = localServerUrl
      ? this.getLocalServerHtml(localServerUrl)
      : this.getBridgeHtml(panel.webview, panelContext);
    this.detectAndPostAgents();

    const unsubscribeEvents = this.deps.runController.onEvent((event) => {
      void panel.webview.postMessage({ type: EVENT_MESSAGE_TYPE, event });
    });

    const messageSub = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!isBridgeCommandMessage(message)) return;
      const command = message.command;

      if (command.kind === "status" || command.kind === "list" || command.kind === "show" || command.kind === "validate") {
        void this.deps.runController.run(undefined, command);
        return;
      }

      const runner = this.deps.resolveRunner(command.agentId);
      if (!runner) {
        void panel.webview.postMessage({
          type: EVENT_MESSAGE_TYPE,
          event: {
            kind: "failed",
            runId: command.runId,
            timestamp: new Date().toISOString(),
            reason: "AI agent execution is disabled in direct OpenSpec mode.",
          },
        });
        return;
      }
      void this.deps.runController.run(runner, command);
    });

    panel.onDidDispose(() => {
      unsubscribeEvents();
      messageSub.dispose();
      this.panel = undefined;
    });
  }

  getContext(): AiPanelContext | undefined {
    return this.panelContext ? { ...this.panelContext } : undefined;
  }

  /** Fire-and-forget: computes agent presence via a direct core import and
   * posts it as a follow-up context message once resolved, without
   * delaying `reveal()` itself (see design.md, "Extension: detection runs
   * after reveal()..."). No-op in optional-local-server mode — that mode's
   * iframe loads the same standalone bundle, which already gets detection
   * via its own REST call, not this message-bridge channel. */
  private detectAndPostAgents(): void {
    if (this.deps.getLocalServerUrl()) return;
    const panel = this.panel;
    if (!panel) return;
    void detectAvailableAgents().then((detectedAgents) => {
      if (!this.panelContext) return;
      this.panelContext = { ...this.panelContext, detectedAgents };
      void panel.webview.postMessage({ type: CONTEXT_MESSAGE_TYPE, context: this.panelContext });
    });
  }

  private getBridgeHtml(webview: vscode.Webview, panelContext?: AiPanelContext): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.deps.extensionUri, "dist", "webview.js"));
    const csp = `default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';`;
    const cwd = escapeHtmlAttribute(panelContext?.cwd ?? "");
    const changeDir = escapeHtmlAttribute(panelContext?.changeDir ?? "");
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>OpenSpec UI</title>
  </head>
  <body>
    <div id="root" data-workspace-root="${cwd}" data-change-directory="${changeDir}"></div>
    <script src="${scriptUri.toString()}"></script>
  </body>
</html>`;
  }

  /** Optional mode (2.3): embeds the same browser shell as the standalone
   * tool, instead of the postMessage bridge. CSP is scoped to that exact
   * localhost address.
   *
   * Marks the iframe `src` with the `embed=vscode-local-server` query
   * parameter (see
   * openspec/changes/standalone-shell-host-aware-tabs/design.md, "Signal
   * mechanism") so the embedded standalone shell shows only the "Run a
   * Command" tab — the other four are already covered by native VS Code
   * UI (diff/tree/file editing). Built via `URL`, not string
   * concatenation, so the parameter lands correctly ahead of the
   * `#token=...` fragment already present in `baseUrl`. */
  private getLocalServerHtml(baseUrl: string): string {
    const iframeUrl = new URL(baseUrl);
    iframeUrl.searchParams.set("embed", "vscode-local-server");
    const iframeSrc = iframeUrl.toString();
    const csp = `default-src 'none'; frame-src ${baseUrl};`;
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>OpenSpec UI</title>
    <style>html, body, iframe { height: 100%; width: 100%; margin: 0; border: 0; }</style>
  </head>
  <body>
    <iframe src="${iframeSrc}"></iframe>
  </body>
</html>`;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
