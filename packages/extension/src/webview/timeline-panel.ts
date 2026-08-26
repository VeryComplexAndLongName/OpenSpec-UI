// A one-shot render of already-fetched data, not a live stream (see
// openspec/changes/add-change-timeline-view/design.md) — no message
// bridge, no local-server alternative mode. The extension host computes
// `ChangeTimeline` via a direct `@openspec-ui/core` import and embeds it
// in the webview's initial HTML; `timeline-entry.tsx` just renders it.

import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import type { ChangeTimeline } from "@openspec-ui/core";

interface MultiChangeTimelinePayload {
  timelines: ChangeTimeline[];
  rangeStart: string;
  rangeEnd: string;
}

export class TimelineWebviewPanel {
  constructor(private readonly deps: { extensionUri: vscode.Uri }) { }

  /** Opens a new webview tab for `timeline` — deliberately not a
   * singleton (unlike `AiPanel`): opening timelines for different
   * changes yields separate tabs a user can compare side by side. */
  show(changeName: string, timeline: ChangeTimeline): void {
    const panel = this.createPanel(`OpenSpec UI: ${changeName} timeline`);
    panel.webview.html = this.getHtml(panel.webview, "__OPENSPEC_UI_TIMELINE__", timeline);
  }

  /** Same not-a-singleton shape as `show()`, for the multi-change
   * comparison view (see openspec/changes/
   * add-multi-change-timeline-view/design.md). */
  showMulti(payload: MultiChangeTimelinePayload): void {
    const panel = this.createPanel("OpenSpec UI: change comparison");
    panel.webview.html = this.getHtml(panel.webview, "__OPENSPEC_UI_MULTI_TIMELINE__", payload);
  }

  private createPanel(title: string): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(
      "openspecUiChangeTimeline",
      title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.deps.extensionUri, "dist")],
      },
    );
  }

  private getHtml(webview: vscode.Webview, globalName: string, payload: unknown): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.deps.extensionUri, "dist", "timeline.js"));
    // A nonce, not a blanket 'unsafe-inline', authorizes only this one
    // inline script — CSP's `script-src` otherwise blocks inline
    // scripts entirely, which silently dropped the data-injection
    // script below (the bundle's own `<script src=...>` tag still
    // matched `webview.cspSource` and ran fine, so the page rendered
    // its "no timeline data" fallback rather than failing loudly).
    const nonce = randomBytes(16).toString("base64");
    const csp = `default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';`;
    // `<` -> `<` prevents an embedded `</script>` sequence (e.g. inside
    // markdown content) from closing the script tag early.
    const payloadJson = JSON.stringify(payload).replaceAll("<", "\\u003c");
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>OpenSpec UI Timeline</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">window.${globalName} = ${payloadJson};</script>
    <script src="${scriptUri.toString()}"></script>
  </body>
</html>`;
  }
}
