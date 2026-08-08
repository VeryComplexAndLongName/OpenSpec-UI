// 2.2 Message bridge между extension host и webview (основной режим).
// 2.3 Если включён локальный сервер — webview вместо моста грузит тот же
// браузерный шелл, что и standalone (см. design.md, "Optional local server
// reuses the same server package as standalone").

import * as vscode from "vscode";
import type { AgentRunner } from "@openspec-ui/core";
import type { RunController } from "../run-controller.js";

const COMMAND_MESSAGE_TYPE = "openspec-ui/command";
const EVENT_MESSAGE_TYPE = "openspec-ui/event";
const CONTEXT_MESSAGE_TYPE = "openspec-ui/context";

export interface AiPanelContext {
  cwd: string;
  changeDir: string;
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
  /** Если локальный сервер включён и запущен — возвращает его базовый URL
   * (`http://127.0.0.1:<port>`); иначе `undefined` (основной режим — мост). */
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

  /** Опциональный режим (2.3): встраивает тот же браузерный шелл, что и
   * standalone-инструмент, вместо моста postMessage. CSP ограничен именно
   * этим localhost-адресом. */
  private getLocalServerHtml(baseUrl: string): string {
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
    <iframe src="${baseUrl}"></iframe>
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
