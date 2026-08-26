// Entry point for the VS Code extension's Timeline webview (see
// openspec/changes/add-change-timeline-view/design.md). Deliberately
// simpler than extension-entry.tsx's message-bridge: the extension host
// already computed the `ChangeTimeline` via a direct `@openspec-ui/core`
// import (no HTTP, no local server) and embeds it as a global before this
// script loads — a one-shot render of already-fetched data, not a live
// stream, so no message listener is needed. Not part of the package's
// public API.

import { createRoot } from "react-dom/client";
import { ChangeTimelineView } from "./components/ChangeTimelineView.js";
import { shellThemeCss, vscodeThemeCss } from "./shell-ui.js";
import type { ChangeTimeline } from "./change-timeline-client.js";

declare global {
  interface Window {
    __OPENSPEC_UI_TIMELINE__?: ChangeTimeline;
  }
}

function TimelineApp({ timeline }: { timeline: ChangeTimeline | undefined }) {
  return (
    <div className="openspec-extension-app">
      <style>{`${shellThemeCss}\n${vscodeThemeCss}`}</style>
      {timeline ? <ChangeTimelineView timeline={timeline} /> : <p>No timeline data.</p>}
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("timeline-entry: #root element not found");
}
createRoot(container).render(<TimelineApp timeline={window.__OPENSPEC_UI_TIMELINE__} />);
