// Entry point for the editor's Pipeline panel — the-pipeline-opens-in-vs-code.
// Not part of the package's public API: bootstrap code for
// `packages/extension`'s build.
//
// The same `PipelineView` the standalone shell draws (ADR 0029). It reads
// over the request channel, and the host says when a reading is out of
// date: it watches the files, so the view does not poll git on a timer.

import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useMemo } from "react";
import type { ChangeReadinessReport, WorktreeSurvey } from "@openspec-ui/core/browser";
import type { VsCodeApiLike } from "./transport/message-bridge-transport.js";
import { createBridgeRequester } from "./bridge-request.js";
import { PipelineView, type PipelineReading } from "./components/PipelineView.js";
import { shellThemeCss, vscodeThemeCss } from "./shell-ui.js";

/** Posted by the host when files a reading depends on have changed. */
export const PIPELINE_CHANGED_MESSAGE_TYPE = "openspec-ui/pipeline-changed";

/** Posted by the view when a change's card is chosen. The host checks the
 * name against its own workspace before it opens anything. */
export const OPEN_CHANGE_MESSAGE_TYPE = "openspec-ui/open-change";

declare function acquireVsCodeApi(): VsCodeApiLike;

function readingsOf(data: unknown): PipelineReading[] {
  if (typeof data !== "object" || data === null) return [];
  const message = data as { type?: unknown; readings?: unknown };
  if (message.type !== PIPELINE_CHANGED_MESSAGE_TYPE || !Array.isArray(message.readings)) return [];
  return message.readings.filter((reading): reading is PipelineReading => reading === "readiness" || reading === "survey");
}

function PipelineApp() {
  const vscodeApi = useMemo(() => acquireVsCodeApi(), []);
  const bridge = useMemo(() => createBridgeRequester(vscodeApi), [vscodeApi]);
  useEffect(() => () => bridge.dispose(), [bridge]);

  const load = useCallback(() => bridge.request<ChangeReadinessReport>("pipeline/readiness"), [bridge]);
  const survey = useCallback(() => bridge.request<WorktreeSurvey>("pipeline/survey"), [bridge]);
  const subscribe = useCallback((listener: (reading: PipelineReading) => void) => {
    const handler = (event: MessageEvent<unknown>) => {
      for (const reading of readingsOf(event.data)) listener(reading);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);
  const onOpenChange = useCallback(
    (changeName: string) => vscodeApi.postMessage({ type: OPEN_CHANGE_MESSAGE_TYPE, changeName }),
    [vscodeApi],
  );

  return (
    <div className="openspec-extension-app">
      <style>{[shellThemeCss, vscodeThemeCss].join(" ")}</style>
      <section className="openspec-shell-panel">
        <h2>Pipeline</h2>
        {/* Always active: the panel is not kept alive while hidden, so a
            page that exists is a page being looked at. */}
        <PipelineView isActive load={load} survey={survey} subscribe={subscribe} onOpenChange={onOpenChange} />
      </section>
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("pipeline-entry: #root element not found");
}
createRoot(container).render(<PipelineApp />);
