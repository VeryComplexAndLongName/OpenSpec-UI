// A one-shot render of already-fetched data, not a live stream (see
// openspec/changes/add-change-timeline-view/design.md) — no message
// bridge, no local-server alternative mode. The extension host computes
// `ChangeTimeline` via a direct `@openspec-ui/core` import and embeds it
// in the webview's initial HTML; `timeline-entry.tsx` just renders it.

import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import type { ChangeSpans, ChangeTimeline, ChangeTimelineRequestEntry } from "@openspec-ui/core";
import { ICON_FONT_SOURCE } from "./icon-font-source.js";

/** What the comparison's webview asks its host for, and what it is
 * given back (the-timeline-compares-changes). */
export interface ComparisonHandlers {
  /** The histories behind the charts, for the rows the webview is
   * showing. */
  readTimelines: (entries: ChangeTimelineRequestEntry[]) => Promise<ChangeTimeline[]>;
  /** One change's own timeline, opened from its row. */
  openTimeline: (changeName: string, archived: boolean) => void | Promise<void>;
}

export class TimelineWebviewPanel {
  constructor(private readonly deps: { extensionUri: vscode.Uri }) { }

  /** Opens a new webview tab for `timeline` — deliberately not a
   * singleton (unlike `AiPanel`): opening timelines for different
   * changes yields separate tabs a user can compare side by side.
   * `staleThresholdDays` (see openspec/changes/
   * add-stale-task-detection/design.md) is embedded alongside the
   * timeline itself, under its own global — `ChangeTimelineView` reads
   * it as a prop, not baked into the `ChangeTimeline` data shape. */
  show(changeName: string, timeline: ChangeTimeline, staleThresholdDays: number): void {
    const panel = this.createPanel(`OpenSpec Workbench: ${changeName} timeline`);
    panel.webview.html = this.getHtml(panel.webview, {
      __OPENSPEC_UI_TIMELINE__: timeline,
      __OPENSPEC_UI_STALE_THRESHOLD_DAYS__: staleThresholdDays,
    });
  }

  /** Same not-a-singleton shape as `show()`, for every change of the
   * workspace on one grid of days (the-timeline-compares-changes).
   *
   * The spans are embedded as the one-shot data this panel has always
   * embedded. The two things the screen cannot answer itself go through
   * `handlers`: the histories its charts rest on, asked for a page of
   * rows at a time rather than for all 264 up front, and opening one
   * change's own timeline. */
  showComparison(spans: ChangeSpans, handlers: ComparisonHandlers): void {
    const panel = this.createPanel("OpenSpec Workbench: change comparison");
    panel.webview.html = this.getHtml(panel.webview, {
      __OPENSPEC_UI_COMPARISON__: { spans: spans.spans, readAt: spans.readAt },
    });
    panel.webview.onDidReceiveMessage((message: unknown) => {
      const asked = message as {
        type?: string;
        entries?: ChangeTimelineRequestEntry[];
        changeName?: string;
        archived?: boolean;
      } | undefined;
      if (asked?.type === "read-timelines" && Array.isArray(asked.entries)) {
        void handlers.readTimelines(asked.entries)
          .then((timelines) => panel.webview.postMessage({ type: "timelines", timelines }))
          // Said in the webview rather than swallowed: a charts section
          // that simply stays empty reads as a workspace with no history.
          .catch((error: unknown) => panel.webview.postMessage({
            type: "timelines-failed",
            error: error instanceof Error ? error.message : String(error),
          }));
        return;
      }
      if (asked?.type === "open-timeline" && typeof asked.changeName === "string") {
        void handlers.openTimeline(asked.changeName, asked.archived === true);
      }
    });
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

  private getHtml(webview: vscode.Webview, globals: Record<string, unknown>): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.deps.extensionUri, "dist", "timeline.js"));
    // A nonce, not a blanket 'unsafe-inline', authorizes only this one
    // inline script — CSP's `script-src` otherwise blocks inline
    // scripts entirely, which silently dropped the data-injection
    // script below (the bundle's own `<script src=...>` tag still
    // matched `webview.cspSource` and ran fine, so the page rendered
    // its "no timeline data" fallback rather than failing loudly).
    const nonce = randomBytes(16).toString("base64");
    const csp = `default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; ${ICON_FONT_SOURCE}`;
    // `<` -> `<` prevents an embedded `</script>` sequence (e.g. inside
    // markdown content) from closing the script tag early.
    const assignments = Object.entries(globals)
      .map(([name, value]) => `window.${name} = ${JSON.stringify(value).replaceAll("<", "\\u003c")};`)
      .join("\n");
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>OpenSpec Workbench Timeline</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">${assignments}</script>
    <script src="${scriptUri.toString()}"></script>
  </body>
</html>`;
  }
}
