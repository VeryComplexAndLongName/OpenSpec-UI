// Entry point for the editor's Pipeline panel — the-pipeline-opens-in-vs-code.
// Not part of the package's public API: bootstrap code for
// `packages/extension`'s build.
//
// The same `PipelineView` the standalone shell draws (ADR 0029). It reads
// over the request channel, and the host says when a reading is out of
// date: it watches the files, so the view does not poll git on a timer.

import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatchUpResult, ChangeReadinessReport, ChangeStageSummary, ChangeStandings, LastRunsReport, LiveRun, MainDrift, RunLogRecord, RunLogSummary, WorktreeSurvey } from "@openspec-ui/core/browser";
import type { VsCodeApiLike } from "./transport/message-bridge-transport.js";
import { createBridgeRequester } from "./bridge-request.js";
import { RunLogsView } from "./components/RunLogsView.js";
import { PipelineView, type AskToStop, type PipelineReading, type PipelineViewMemory, type RunControl } from "./components/PipelineView.js";
import { shellThemeCss, vscodeThemeCss } from "./shell-ui.js";
import { metroCss } from "./metro-css.generated.js";
import { metroIconsCss } from "./metro-icons.generated.js";
import { metroRootClassName, useEditorDarkTheme } from "./vscode-theme.js";

/** Posted by the host when files a reading depends on have changed. */
export const PIPELINE_CHANGED_MESSAGE_TYPE = "openspec-ui/pipeline-changed";

/** Posted by the view when a change's card is chosen. The host checks the
 * name against its own workspace before it opens anything. */
export const OPEN_CHANGE_MESSAGE_TYPE = "openspec-ui/open-change";

/** Posted by the view when a card's Start is pressed. The host checks the
 * name and opens that change's run dialog (a-change-is-run-from-its-card). */
export const RUN_CHANGE_MESSAGE_TYPE = "openspec-ui/run-change";

/** Posted by the view when a card answers or stops a run. The host acts
 * only on a run it holds. */
export const RUN_CONTROL_MESSAGE_TYPE = "openspec-ui/run-control";

/** Posted by the view when a card asks a run held elsewhere to stop. The
 * host asks only a run it reads as live, with its own key
 * (a-run-elsewhere-can-be-asked-to-stop). */
export const ASK_TO_STOP_MESSAGE_TYPE = "openspec-ui/ask-to-stop";
/** The folded row's press: the host archives the changes it names
 * (what-is-finished-is-tidied-away). */
export const ARCHIVE_CHANGES_MESSAGE_TYPE = "openspec-ui/archive-changes";

/** The webview API, with the state the webview keeps while its panel is
 * hidden and destroyed. */
declare function acquireVsCodeApi(): VsCodeApiLike & { getState(): unknown; setState(state: unknown): void };

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
  // The host fetches refs now and says how fresh they are
  // (a-change-says-where-it-stands).
  const refresh = useCallback(() => bridge.request<string>("pipeline/refresh"), [bridge]);
  // Read with the survey: the host's survey signal is its signal too
  // (a-card-says-what-its-change-is-doing).
  const lastRuns = useCallback(() => bridge.request<LastRunsReport>("pipeline/last-runs"), [bridge]);
  // So a card says the word the Changes tree says (ADR 0029's amendment).
  const standings = useCallback(() => bridge.request<ChangeStandings>("pipeline/standings"), [bridge]);
  // Where each change is on the board, and who holds it
  // (the-board-shows-the-stages).
  const stages = useCallback(() => bridge.request<ChangeStageSummary[]>("pipeline/stages"), [bridge]);

  // How far this checkout is behind what has landed, and the one press
  // that closes it (main-catches-up-with-what-landed).
  const drift = useCallback(
    async () => (await bridge.request<MainDrift | null>("pipeline/drift")) ?? undefined,
    [bridge],
  );
  const catchUp = useCallback(() => bridge.request<CatchUpResult>("pipeline/catch-up"), [bridge]);
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
  // The runs this extension host holds, and the controls a card sends for
  // them (a-change-is-run-from-its-card).
  const liveRuns = useCallback(() => bridge.request<{ runs: LiveRun[]; myLabel?: string }>("pipeline/live-runs"), [bridge]);
  const onRunControl = useCallback(
    (control: RunControl) => vscodeApi.postMessage({ type: RUN_CONTROL_MESSAGE_TYPE, control }),
    [vscodeApi],
  );
  const onStart = useCallback(
    (changeName: string) => vscodeApi.postMessage({ type: RUN_CHANGE_MESSAGE_TYPE, changeName }),
    [vscodeApi],
  );
  const copyText = useCallback((text: string) => navigator.clipboard.writeText(text), []);
  // A change's run logs, beneath the picture, as the standalone shows them
  // (a-change-shows-its-run-logs).
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const logsLoad = useCallback(() => bridge.request<RunLogSummary[]>("pipeline/run-logs", { changeName: logsFor ?? "" }), [bridge, logsFor]);
  const logsRead = useCallback((runId: string) => bridge.request<RunLogRecord[]>("pipeline/run-log", { runId }), [bridge]);
  // The zoom and the open cards, in the webview's own state: the panel does
  // not keep its page while hidden, so a view that kept them alone would
  // reset every time (a-card-opens-to-its-tasks). The view guards both.
  const viewState = useMemo(() => ({
    read: () => {
      const state = vscodeApi.getState();
      return typeof state === "object" && state !== null ? (state as { pipelineView?: PipelineViewMemory }).pipelineView : undefined;
    },
    write: (memory: PipelineViewMemory) => {
      const state = vscodeApi.getState();
      vscodeApi.setState({ ...(typeof state === "object" && state !== null ? state : {}), pipelineView: memory });
    },
  }), [vscodeApi]);
  const onAskToStop = useCallback(
    (request: AskToStop) => vscodeApi.postMessage({ type: ASK_TO_STOP_MESSAGE_TYPE, ...request }),
    [vscodeApi],
  );
  const onArchive = useCallback(
    (changeNames: string[]) => vscodeApi.postMessage({ type: ARCHIVE_CHANGES_MESSAGE_TYPE, changeNames }),
    [vscodeApi],
  );

  const editorDark = useEditorDarkTheme();

  return (
    <div className={metroRootClassName("openspec-extension-app", editorDark)}>
      <style>{[metroCss, metroIconsCss, shellThemeCss, vscodeThemeCss].join(" ")}</style>
      <section className="openspec-shell-panel">
        <h2>Pipeline</h2>
        {/* Always active: the panel is not kept alive while hidden, so a
            page that exists is a page being looked at. */}
        <PipelineView isActive load={load} survey={survey} subscribe={subscribe} onOpenChange={onOpenChange} refresh={refresh} lastRuns={lastRuns} standings={standings} stages={stages} drift={drift} onCatchUp={catchUp} liveRuns={liveRuns} onRunControl={onRunControl} onStart={onStart} onViewLogs={setLogsFor} copyText={copyText} viewState={viewState} onAskToStop={onAskToStop} onArchive={onArchive} />
        {logsFor !== null ? <RunLogsView changeName={logsFor} load={logsLoad} read={logsRead} onClose={() => setLogsFor(null)} /> : null}
      </section>
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("pipeline-entry: #root element not found");
}
createRoot(container).render(<PipelineApp />);
