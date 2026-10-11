import * as vscode from "vscode";
import { dispatchCompliance } from "@openspec-ui/core";
import { ICON_FONT_SOURCE } from "./icon-font-source.js";

export class CompliancePanel implements vscode.Disposable {
  private panel?: vscode.WebviewPanel;
  constructor(private readonly extensionUri: vscode.Uri, private readonly workspaceRoot: () => string | undefined,
    private readonly onPolicy?: (enabled: boolean) => void) {}

  show(): void {
    if (this.panel) { this.panel.reveal(); return; }
    const panel = vscode.window.createWebviewPanel("openspecCompliance", "Compliance", vscode.ViewColumn.Beside,
      { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")] });
    this.panel = panel;
    const script = panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "compliance.js"));
    panel.webview.html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${panel.webview.cspSource}; style-src ${panel.webview.cspSource} 'unsafe-inline'; ${ICON_FONT_SOURCE}"></head><body><div id="root"></div><script src="${script}"></script></body></html>`;
    const listener = panel.webview.onDidReceiveMessage((value: unknown) => {
      if (typeof value !== "object" || value === null) return;
      const message = value as { type?: unknown; id?: unknown; request?: unknown };
      if (message.type !== "compliance" || typeof message.id !== "string") return;
      const root = this.workspaceRoot();
      if (!root) return;
      void dispatchCompliance(root, message.request).then(reading => {
        this.onPolicy?.(reading.policy.backgroundEnabled);
        return panel.webview.postMessage({ type: "compliance-result", id: message.id, reading });
      },
        error => panel.webview.postMessage({ type: "compliance-result", id: message.id, error: error instanceof Error ? error.message : "Compliance failed" }));
    });
    panel.onDidDispose(() => { listener.dispose(); this.panel = undefined; });
  }

  dispose(): void { this.panel?.dispose(); }
}