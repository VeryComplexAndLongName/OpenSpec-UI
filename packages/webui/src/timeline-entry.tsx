// Entry point for the VS Code extension's Timeline webview (see
// openspec/changes/add-change-timeline-view/design.md). One change's
// timeline is a one-shot render: the extension host already computed the
// `ChangeTimeline` via a direct `@openspec-ui/core` import (no HTTP, no
// local server) and embedded it as a global before this script loads.
//
// The comparison is the same one-shot render of the spans, plus the two
// messages it cannot answer itself (the-timeline-compares-changes): the
// histories its charts rest on, which the host reads, and opening one
// change's own timeline, which the host opens. That is the message bridge
// ADR 0001 names as the extension's primary mode, not a local server.
//
// Not part of the package's public API.

import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  comparisonRows,
  comparisonWindow,
  DEFAULT_COMPARISON_PERIOD,
  describeComparison,
  type ChangeSpan,
  type ComparisonPeriodId,
} from "@openspec-ui/core/browser";
import { ChangeTimelineView } from "./components/ChangeTimelineView.js";
import { ChangeComparisonView } from "./components/ChangeComparisonView.js";
import { shellThemeCss, vscodeThemeCss } from "./shell-ui.js";
import { metroCss } from "./metro-css.generated.js";
import { metroIconsCss } from "./metro-icons.generated.js";
import { metroRootClassName, useEditorDarkTheme } from "./vscode-theme.js";
import type { ChangeTimeline } from "./change-timeline-client.js";

interface ComparisonPayload {
  spans: ChangeSpan[];
  /** When the host read them, so the dashed line marks the reading rather
   * than whenever this webview happened to render. */
  readAt: string;
}

interface WebviewApi {
  postMessage(message: unknown): void;
}

declare global {
  interface Window {
    __OPENSPEC_UI_TIMELINE__?: ChangeTimeline;
    __OPENSPEC_UI_COMPARISON__?: ComparisonPayload;
    __OPENSPEC_UI_STALE_THRESHOLD_DAYS__?: number;
    acquireVsCodeApi?: () => WebviewApi;
  }
}

let webviewApi: WebviewApi | undefined;

/** The webview's own channel to the extension host, acquired once — VS
 * Code refuses a second call. Absent outside a webview, where nothing is
 * posted at all. */
function host(): WebviewApi | undefined {
  webviewApi ??= window.acquireVsCodeApi?.();
  return webviewApi;
}

function keyOf(entry: { changeName: string; archived: boolean }): string {
  return `${entry.archived ? "archived" : "active"}:${entry.changeName}`;
}

export function ComparisonApp({ payload }: { payload: ComparisonPayload }) {
  const [period, setPeriod] = useState<ComparisonPeriodId>(DEFAULT_COMPARISON_PERIOD);
  const [filter, setFilter] = useState("");
  const [timelines, setTimelines] = useState<ChangeTimeline[]>([]);
  const [reading, setReading] = useState(0);
  const [chartsError, setChartsError] = useState<string | null>(null);
  const now = useMemo(() => {
    const read = Date.parse(payload.readAt);
    return Number.isNaN(read) ? Date.now() : read;
  }, [payload.readAt]);

  const days = useMemo(() => comparisonWindow(period, payload.spans, now), [period, payload.spans, now]);
  const all = useMemo(() => comparisonRows(payload.spans, days, now), [payload.spans, days, now]);
  const shown = useMemo(() => comparisonRows(payload.spans, days, now, filter), [payload.spans, days, now, filter]);
  const wanted = shown.map((row) => ({ changeName: row.changeName, archived: !row.active }));
  const wantedKey = wanted.map(keyOf).join("|");

  // What the host sends back. Kept by change, so a period changed twice
  // does not ask for the same history twice.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const message = event.data as { type?: string; timelines?: ChangeTimeline[]; error?: string } | undefined;
      if (message?.type === "timelines" && Array.isArray(message.timelines)) {
        const arrived = message.timelines;
        setTimelines((held) => {
          const byChange = new Map(held.map((one) => [keyOf(one), one]));
          for (const one of arrived) byChange.set(keyOf(one), one);
          return [...byChange.values()];
        });
        setChartsError(null);
        setReading(0);
      } else if (message?.type === "timelines-failed") {
        setChartsError(`The charts could not be read: ${message.error ?? "the read failed"}`);
        setReading(0);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const held = new Set(timelines.map(keyOf));
    const missing = wanted.filter((entry) => !held.has(keyOf(entry)));
    if (missing.length === 0) return;
    setReading(missing.length);
    host()?.postMessage({ type: "read-timelines", entries: missing });
  }, [wantedKey]);

  const forCharts = timelines.filter((one) => wanted.some((entry) => keyOf(entry) === keyOf(one)));

  return (
    <>
      {/* The panel has no page head, so the screen names itself, as the
          one-change view does with its heading. */}
      <header className="openspec-change-timeline-heading" data-testid="comparison-heading">
        <h2>Compare changes</h2>
        <p>{describeComparison(shown, days, now)}</p>
      </header>
      <ChangeComparisonView
        window={days}
        rows={shown}
        total={all.length}
        period={period}
        onPeriod={setPeriod}
        filter={filter}
        onFilter={setFilter}
        now={now}
        onOpen={(changeName, archived) => host()?.postMessage({ type: "open-timeline", changeName, archived })}
        timelines={forCharts}
        readingCharts={reading > 0 ? `Reading the history of ${reading} ${reading === 1 ? "change" : "changes"} from git…` : null}
        chartsError={chartsError}
      />
    </>
  );
}

function TimelineApp({
  timeline,
  comparison,
  staleThresholdDays,
}: {
  timeline: ChangeTimeline | undefined;
  comparison: ComparisonPayload | undefined;
  staleThresholdDays: number | undefined;
}) {
  const editorDark = useEditorDarkTheme();

  return (
    <div className={metroRootClassName("openspec-extension-app", editorDark)}>
      <style>{`${metroCss}\n${metroIconsCss}\n${shellThemeCss}\n${vscodeThemeCss}`}</style>
      {timeline ? (
        // The panel has no page head, so the view names the change itself
        // (the-change-timeline-looks-like-the-mockup 4.1).
        <ChangeTimelineView timeline={timeline} staleThresholdDays={staleThresholdDays} heading />
      ) : comparison ? (
        <ComparisonApp payload={comparison} />
      ) : (
        <p>No timeline data.</p>
      )}
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("timeline-entry: #root element not found");
}
createRoot(container).render(
  <TimelineApp
    timeline={window.__OPENSPEC_UI_TIMELINE__}
    comparison={window.__OPENSPEC_UI_COMPARISON__}
    staleThresholdDays={window.__OPENSPEC_UI_STALE_THRESHOLD_DAYS__}
  />,
);
