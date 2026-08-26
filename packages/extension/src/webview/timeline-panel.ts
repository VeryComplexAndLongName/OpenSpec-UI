// A one-shot render of already-fetched data, not a live stream (see
// openspec/changes/add-change-timeline-view/design.md) — no message
// bridge, no local-server alternative mode. The extension host computes
// `ChangeTimeline` via a direct `@openspec-ui/core` import and embeds it
// in the webview's initial HTML; `timeline-entry.tsx` just renders it.

import * as vscode from "vscode";
import type { ChangeTimeline } from "@openspec-ui/core";

export class TimelineWebviewPanel {
  constructor(private readonly deps: { extensionUri: vscode.Uri }) { }

  /** Opens a new webview tab for `timeline` — deliberately not a
   * singleton (unlike `AiPanel`): opening timelines for different
   * changes yields separate tabs a user can compare side by side. */
  show(changeName: string, timeline: ChangeTimeline): void {
    const panel = vscode.window.createWebviewPanel(
      "openspecUiChangeTimeline",
      `OpenSpec UI: ${changeName} timeline`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.deps.extensionUri, "dist")],
      },
    );
    panel.webview.html = this.getHtml(panel.webview, timeline);
  }

  private getHtml(webview: vscode.Webview, timeline: ChangeTimeline): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.deps.extensionUri, "dist", "timeline.js"));
    const csp = `default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';`;
    // `<` -> `<` prevents an embedded `</script>` sequence (e.g. inside
    // markdown content) from closing the script tag early.
    const timelineJson = JSON.stringify(timeline).replaceAll("<", "\\u003c");
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>OpenSpec UI Timeline</title>
  </head>
  <body>
    <div id="root"></div>
    <script>window.__OPENSPEC_UI_TIMELINE__ = ${timelineJson};</script>
    <script src="${scriptUri.toString()}"></script>
  </body>
</html>`;
  }
}
