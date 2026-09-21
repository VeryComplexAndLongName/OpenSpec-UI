// The editor's harness settings: one panel for the global file, and one
// panel per change, titled with the change's name.
//
// The settings view used to be mounted inside the AI panel. A newly opened
// panel learned the change's name only after the view had mounted, so a
// person who ran "Configure Harness for this Change" on a change saw the
// global defaults, an empty name field, and nothing to configure. Here the
// scope and the change's name are in the root element the page is rendered
// with, so the view has them on its first render. See
// a-change-is-configured-from-the-change.

import * as vscode from "vscode";
import {
  answerHarnessRequest,
  asHarnessRequest,
  REQUEST_MESSAGE_TYPE,
  RESPONSE_MESSAGE_TYPE,
} from "./harness-requests.js";
import { ICON_FONT_SOURCE } from "./icon-font-source.js";

/** Posted by a change's panel when someone asks for the global defaults. */
export const EDIT_GLOBAL_HARNESS_MESSAGE_TYPE = "openspec-ui/edit-global-harness";

export const GLOBAL_HARNESS_PANEL_TITLE = "OpenSpec Workbench: Harness Settings";

export function changeHarnessPanelTitle(changeName: string): string {
  return `Harness: ${changeName}`;
}

export interface HarnessSettingsPanelDeps {
  extensionUri: vscode.Uri;
  getWorkspaceRoot: () => string | undefined;
}

/** A request as the host saw it, for a test to observe. */
export interface ObservedHarnessRequest {
  changeName?: string;
  op: string;
  args?: unknown;
}

export class HarnessSettingsPanel {
  private globalPanel: vscode.WebviewPanel | undefined;
  private readonly changePanels = new Map<string, vscode.WebviewPanel>();
  private readonly testResponseListeners = new Set<(response: unknown) => void>();
  private readonly testRequestListeners = new Set<(request: ObservedHarnessRequest) => void>();

  constructor(private readonly deps: HarnessSettingsPanelDeps) { }

  /** One panel per window for the global file, revealed when it is open. */
  showGlobal(): void {
    if (this.globalPanel) {
      this.globalPanel.reveal();
      return;
    }
    this.globalPanel = this.open(GLOBAL_HARNESS_PANEL_TITLE, undefined, () => { this.globalPanel = undefined; });
  }

  /** One panel per change, revealed when it is open. Two changes side by
   * side are ordinary with worktrees, so a single panel that switched
   * between them would take away the comparison. */
  showChange(changeName: string): void {
    const existing = this.changePanels.get(changeName);
    if (existing) {
      existing.reveal();
      return;
    }
    const panel = this.open(changeHarnessPanelTitle(changeName), changeName, () => { this.changePanels.delete(changeName); });
    this.changePanels.set(changeName, panel);
  }

  private open(title: string, changeName: string | undefined, onDispose: () => void): vscode.WebviewPanel {
    // Not retained while hidden: everything the form shows can be read
    // again, and a hidden settings form has nothing live to keep.
    const panel = vscode.window.createWebviewPanel(
      "openspecUiHarnessSettings",
      title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.deps.extensionUri, "dist")],
      },
    );
    panel.webview.html = this.getHtml(panel.webview, changeName);
    const messages = panel.webview.onDidReceiveMessage((message: unknown) => this.handleMessage(panel, changeName, message));
    panel.onDidDispose(() => {
      messages.dispose();
      onDispose();
    });
    return panel;
  }

  private handleMessage(panel: vscode.WebviewPanel, changeName: string | undefined, message: unknown): void {
    if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === EDIT_GLOBAL_HARNESS_MESSAGE_TYPE) {
      this.showGlobal();
      return;
    }
    const request = asHarnessRequest(message);
    if (!request) return;
    for (const listener of this.testRequestListeners) {
      listener({ ...(changeName !== undefined ? { changeName } : {}), op: String(request.op), args: request.args });
    }
    void answerHarnessRequest(this.deps.getWorkspaceRoot(), request, (body) => {
      const response = { type: RESPONSE_MESSAGE_TYPE, id: request.id, ...body };
      for (const listener of this.testResponseListeners) listener(response);
      void panel.webview.postMessage(response);
    });
  }

  private getHtml(webview: vscode.Webview, changeName: string | undefined): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.deps.extensionUri, "dist", "harness-settings.js"));
    const csp = `default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; ${ICON_FONT_SOURCE}`;
    const scope = changeName === undefined ? "global" : "change";
    const name = escapeHtmlAttribute(changeName ?? "");
    const title = escapeHtmlAttribute(changeName === undefined ? GLOBAL_HARNESS_PANEL_TITLE : changeHarnessPanelTitle(changeName));
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root" data-scope="${scope}" data-change-name="${name}"></div>
    <script src="${scriptUri.toString()}"></script>
  </body>
</html>`;
  }

  private panelFor(changeName: string | undefined): vscode.WebviewPanel | undefined {
    return changeName === undefined ? this.globalPanel : this.changePanels.get(changeName);
  }

  /** Test-only in intent, real API in effect: delivers a request through
   * the same handler a real webview message reaches. No-op when that
   * panel is not open. */
  deliverRequestForTesting(request: { id: string; op: string; args?: unknown }, changeName?: string): void {
    const panel = this.panelFor(changeName);
    if (!panel) return;
    this.handleMessage(panel, changeName, { type: REQUEST_MESSAGE_TYPE, ...request });
  }

  deliverEditGlobalForTesting(changeName: string): void {
    const panel = this.panelFor(changeName);
    if (!panel) return;
    this.handleMessage(panel, changeName, { type: EDIT_GLOBAL_HARNESS_MESSAGE_TYPE });
  }

  onResponseForTesting(listener: (response: unknown) => void): vscode.Disposable {
    this.testResponseListeners.add(listener);
    return { dispose: () => this.testResponseListeners.delete(listener) };
  }

  /** Observes every request a panel's webview sends — including the ones
   * a real webview sends by itself when it renders, which is how a test
   * can tell that a change's panel loaded that change. */
  onRequestForTesting(listener: (request: ObservedHarnessRequest) => void): vscode.Disposable {
    this.testRequestListeners.add(listener);
    return { dispose: () => this.testRequestListeners.delete(listener) };
  }

  getTitleForTesting(changeName?: string): string | undefined {
    return this.panelFor(changeName)?.title;
  }

  getHtmlForTesting(changeName?: string): string | undefined {
    return this.panelFor(changeName)?.webview.html;
  }

  /** How many panels are open: the global one, if any, and one per change. */
  countForTesting(): number {
    return (this.globalPanel ? 1 : 0) + this.changePanels.size;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
