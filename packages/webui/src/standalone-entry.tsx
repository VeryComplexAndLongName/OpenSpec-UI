// Entry point for the standalone browser shell (see
// openspec/changes/standalone-app/tasks.md 2.1). Not part of the package's
// public API (not re-exported from index.ts) — this is bootstrap code
// specifically for `packages/server`'s build (see scripts/build-client.mjs),
// not library code reused in the extension.

import { createRoot } from "react-dom/client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FetchTransport } from "./transport/fetch-transport.js";
import { AiPanel } from "./components/AiPanel.js";
import { describeRunCompletionNotification } from "./notify-run-completion.js";
import { ChangeDiff } from "./components/ChangeDiff.js";
import { loadChangeDiff, type ChangeDiffAnswer } from "./change-diff-client.js";
import { Icon } from "./components/Icon.js";
import { ChangeTimelineView } from "./components/ChangeTimelineView.js";
import { ChangePicker, type ChangePickerOption } from "./components/ChangePicker.js";
import { ChangesList } from "./components/ChangesList.js";
import { RecentlyArchivedPanel, SpecsPanel } from "./components/SummaryPanels.js";
import { summaryFigures, type SummaryTile } from "./summary-figures.js";
import type { IconMeaning } from "./icons.js";
import { ProcessesView, type ProcessesApi } from "./components/ProcessesView.js";
import { PipelineView, SURVEY_POLL_INTERVAL_MS, type AskToStop, type PipelineViewMemory, type RunControl } from "./components/PipelineView.js";
import { useStandingStates } from "./standing-states.js";

/** The icon each of the summary's tiles carries. */
const SUMMARY_TILE_ICONS: Record<SummaryTile["key"], IconMeaning> = {
  changes: "change",
  archived: "archive",
  specs: "spec",
  waiting: "ok",
};

/** Where the standalone shell keeps what a viewer left the Pipeline as. */
const PIPELINE_VIEW_STORAGE_KEY = "openspec-ui.pipeline-view";

/** How long the comparison waits before asking for the histories its
 * charts rest on, so pressing through the periods asks once rather than
 * four times (the-timeline-compares-changes). */
const CHARTS_ASKED_AFTER_MS = 600;
import { loadChangeReadiness } from "./change-readiness-client.js";
import { loadWorkspaceLeftovers, removeWorkspaceLeftover, type WorkspaceLeftoverReading } from "./change-leftovers-client.js";
import { LeftoverList } from "./components/LeftoverList.js";
import { loadChangeLastRuns } from "./change-last-runs-client.js";
import { askRunToStop as askRunToStopRequest, loadLiveRuns } from "./live-runs-client.js";
import { loadWorktreeSurvey } from "./worktree-survey-client.js";
import { Tabs, TabPanel } from "./components/Tabs.js";
import { PanelStatus } from "./components/PanelStatus.js";
import { BusyFieldset } from "./components/BusyFieldset.js";
import { busyTabs, tabReadings } from "./tab-readings.js";
import { useShownReadings } from "./shown-readings.js";
import { buildDefaultChangeDir, shellThemeCss } from "./shell-ui.js";
import { metroCss } from "./metro-css.generated.js";
import { metroIconsCss } from "./metro-icons.generated.js";
import { useStandaloneTheme } from "./standalone-theme.js";
import { AppBar } from "./components/AppBar.js";
import { PageHead } from "./components/PageHead.js";
import { PAGE_HEADS } from "./page-heads.js";
import { VSCODE_LOCAL_SERVER_EMBED_SIGNAL, computeVisibleTabs, embedTheme, initialTab, readEmbedSignal } from "./host-embed.js";
import { renderMarkdown } from "./markdown.js";
import {
  ChangeEditorSaveConflictError,
  loadArchivedTasksTemplate,
  loadChangeEditorDocument,
  mergeTasksTemplate,
  saveChangeEditorDocument,
  type ChangeEditorFiles,
} from "./change-editor-client.js";
import { loadChangeSpans, loadChangeTimeline, loadChangeTimelines, type ChangeSpan, type ChangeTimeline, type ChangeTimelineEntry } from "./change-timeline-client.js";
import { fetchSprintReportPdf } from "./sprint-report-client.js";
import { ChangeComparisonView } from "./components/ChangeComparisonView.js";
import {
  customizeTemplate as customizeTemplateApi,
  deleteProjectTemplate as deleteProjectTemplateApi,
  listTemplates as listTemplatesApi,
  renderTemplate as renderTemplateApi,
} from "./template-catalog-client.js";
import { detectAgents as detectAgentsApi } from "./agent-detection-client.js";
import {
  readChangeHarnessOverride as readChangeHarnessOverrideApi,
  resolveHarnessConfig as resolveHarnessConfigApi,
  writeHarnessConfig as writeHarnessConfigApi,
} from "./harness-config-client.js";
import { GlobalHarnessSettingsView } from "./components/GlobalHarnessSettingsView.js";
import { ChangeHarnessSettingsView } from "./components/ChangeHarnessSettingsView.js";
import type { HarnessSettingsApi } from "./components/harness-settings-parts.js";
import { HarnessChainPanel } from "./components/HarnessChainPanel.js";
import { RunDialog } from "./components/RunDialog.js";
import { loadWorkspaceRunStats } from "./workspace-run-stats-client.js";
import { loadCustomAgents } from "./custom-agents-client.js";
import {
  confirmEnrolment as confirmEnrolmentApi,
  loadHumanOnlyInbox,
  runDelegatedItem as runDelegatedItemApi,
} from "./human-only-inbox-client.js";
import { loadChangeStandings } from "./change-standings-client.js";
import { EnrolmentRequests } from "./components/EnrolmentRequests.js";
import { DelegatedReply } from "./components/DelegatedReply.js";
import {
  addScheduledRun as addScheduledRunApi,
  loadScheduledRuns,
  removeScheduledRun as removeScheduledRunApi,
} from "./scheduled-runs-client.js";
import {
  applyTemplateToChange as applyTemplateToChangeApi,
  putAgentOnEveryStage as putAgentOnEveryStageApi,
  resolveRunWithHarnessDispatch,
  type RunWithHarnessDispatch,
} from "./run-with-harness-dispatch.js";
import { fireDueSchedule, type ScheduleFiringHost } from "./scheduled-run-firing.js";
import {
  comparisonRows,
  comparisonWindow,
  DEFAULT_COMPARISON_PERIOD,
  DEFAULT_STALE_TASK_THRESHOLD_DAYS,
  describeChangeState,
  describeComparison,
  describeHumanOnlyInboxState,
  describeStandingSources,
  describeWaitingOn,
  withoutArchivePrefix,
  type ChangeStandings,
  type ComparisonPeriodId,
  type DescribedChangeState,
} from "@openspec-ui/core/browser";
import type { CatalogTemplate, ChangeReadinessReport, CommandKind, Event, HarnessBudget, HarnessStepAgents, HarnessTemplate, HumanOnlyInboxState, RunPathId, WorkspaceRunStats } from "@openspec-ui/core/browser";
import { toChangeState, toChangeSummary } from "./overview-mapping.js";

/** What a delegated item's last run reported, shown beside its row: the
 * sentence and, for a run that stopped, what the agent last said. */
interface DelegatedOutcome {
  message: string;
  lastStderr?: string;
}

interface OverviewChange {
  name: string;
  status: string;
  completedTasks: number;
  totalTasks: number;
  lastModified: string;
}

interface OverviewArchivedChangeSummary {
  name: string;
  completedTasks: number;
  totalTasks: number;
  lastModified: string;
}

interface OverviewSpec {
  id: string;
  requirementCount: number;
}

interface OverviewRoot {
  path: string;
  source: string;
}

interface OpenSpecOverview {
  root: OverviewRoot;
  changes: OverviewChange[];
  specs: OverviewSpec[];
  archivedChanges: string[];
  archivedChangeSummaries: OverviewArchivedChangeSummary[];
  initialization: {
    hasOpenSpecDir: boolean;
    hasInitializationArtifacts: boolean;
    canInitialize: boolean;
  };
}

const SUPPORTED_INIT_TOOLS = [
  "amazon-q",
  "antigravity",
  "auggie",
  "bob",
  "claude",
  "cline",
  "codeartsagent",
  "codex",
  "devin",
  "forgecode",
  "codebuddy",
  "continue",
  "costrict",
  "crush",
  "cursor",
  "factory",
  "gemini",
  "github-copilot",
  "hermes",
  "iflow",
  "junie",
  "kilocode",
  "kimi",
  "kiro",
  "lingma",
  "vibe",
  "oh-my-pi",
  "opencode",
  "pi",
  "qoder",
  "qwen",
  "roocode",
  "trae",
  "zcode",
] as const;

type EditorTab = keyof ChangeEditorFiles;

const EMPTY_EDITOR_FILES: ChangeEditorFiles = {
  proposal: "",
  design: "",
  tasks: "",
  spec: "",
};

function MarkdownPreview({ content }: { content: string }) {
  return <div className="openspec-md-preview" data-testid="change-editor-preview">{renderMarkdown(content)}</div>;
}

const STORAGE_KEYS = {
  cwd: "openspec-ui:standalone:cwd",
  changeDir: "openspec-ui:standalone:changeDir",
};

function readStoredValue(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures in restricted environments.
  }
}

function readAccessToken(): string {
  return new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
}

const accessToken = readAccessToken();

// Host-aware tab visibility: computed once at module init (before first
// render) from the `embed` query parameter — see ./host-embed.ts and
// openspec/changes/standalone-shell-host-aware-tabs/design.md, "Signal
// mechanism".
const visibleTabs = computeVisibleTabs(readEmbedSignal(window.location.search));
const visibleTabIds = new Set(visibleTabs.map((tab) => tab.id));

// Version footer is standalone-only — see openspec/changes/
// standalone-version-display/proposal.md. The VS Code local-server iframe
// keeps its own extension version visible via VS Code's Extensions view.
const isStandaloneHost = readEmbedSignal(window.location.search) !== VSCODE_LOCAL_SERVER_EMBED_SIGNAL;

// Injected at build time by packages/server/scripts/client-build-options.mjs
// (esbuild `define`) from packages/webui/package.json — the browser bundle
// has no filesystem access to read its own package.json at runtime.
declare const __OPENSPEC_UI_WEBUI_VERSION__: string;

interface WorkbenchVersions {
  core: string;
  server: string;
}

function apiFetch(pathname: string, init: RequestInit): Promise<Response> {
  return fetch(`${window.location.origin}${pathname}`, {
    ...init,
    headers: {
      ...init.headers,
      "x-openspec-ui-token": accessToken,
    },
  });
}

interface WorkspaceRootResponse {
  workspaceRoot: string;
}

async function loadWorkspaceRoot(): Promise<string> {
  const response = await apiFetch("/api/workspace-root", { method: "GET" });
  const payload = (await response.json().catch(() => ({}))) as Partial<WorkspaceRootResponse> & { error?: string };
  if (!response.ok || typeof payload.workspaceRoot !== "string" || payload.workspaceRoot.trim().length === 0) {
    const reason = payload.error ?? `${response.status} ${response.statusText}`;
    throw new Error(`failed to load workspace root: ${reason}`);
  }
  return payload.workspaceRoot;
}

function StandaloneApp() {
  // Framed by the editor, the editor's light or dark comes with the address.
  const { theme, toggle: toggleTheme } = useStandaloneTheme(undefined, embedTheme(window.location.search));
  const [activeTab, setActiveTab] = useState<string>(() => initialTab(window.location.search, visibleTabs));
  const [cwd, setCwd] = useState(() => readStoredValue(STORAGE_KEYS.cwd));
  const [changeDir, setChangeDir] = useState(() => readStoredValue(STORAGE_KEYS.changeDir));
  const [overview, setOverview] = useState<OpenSpecOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  // Diff Preview: the chosen change and what git said about it
  // (a-screen-says-what-it-is-doing). `diffReading` counts readings, so a
  // reply for a change since left behind sets nothing.
  const [diffChangeName, setDiffChangeName] = useState("");
  const [diffAnswer, setDiffAnswer] = useState<ChangeDiffAnswer | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const diffReading = useRef(0);
  const [editorChangeName, setEditorChangeName] = useState("");
  const [editorFiles, setEditorFiles] = useState<ChangeEditorFiles>(EMPTY_EDITOR_FILES);
  const [editorRevision, setEditorRevision] = useState("");
  const [editorTab, setEditorTab] = useState<EditorTab>("proposal");
  /** The change's harness settings, shown in place of the markdown
   * editor. A change is configured from the change, not from a page
   * about the whole workspace. See a-change-is-configured-from-the-change. */
  const [harnessPaneOpen, setHarnessPaneOpen] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorCreating, setEditorCreating] = useState(false);
  const [newChangeName, setNewChangeName] = useState("");
  const [newChangeDescription, setNewChangeDescription] = useState("");
  const [editorMessage, setEditorMessage] = useState<string | null>(null);
  const [chainChangeDir, setChainChangeDir] = useState<string | null>(null);
  // What the run entry resolved, held so it can be shown before it is
  // acted on. `null` means no dialog is open.
  const [runDispatch, setRunDispatch] = useState<RunWithHarnessDispatch | null>(null);
  // Read beside the plan, not with it: the figures are about the
  // workspace rather than this change, and a failure to read them must
  // not stop a run from being started.
  const [runStats, setRunStats] = useState<WorkspaceRunStats | undefined>(undefined);
  const [chainBudget, setChainBudget] = useState<HarnessBudget | undefined>(undefined);
  const [runHarnessLoading, setRunHarnessLoading] = useState(false);
  const [runHarnessMessage, setRunHarnessMessage] = useState<string | null>(null);
  /** What the last apply in the run dialog wrote, and where — said beside
   * the button that did it rather than above the dialog. */
  const [runAppliedNote, setRunAppliedNote] = useState<string | null>(null);
  const [runUseAgentNote, setRunUseAgentNote] = useState<string | null>(null);
  // Which change the open run dialog is for, and where it was opened: the
  // Change Editor, or a Pipeline card's Start (a-change-is-run-from-its-card).
  // Every action in the dialog acts on this name, never on whichever change
  // the editor happens to show.
  const [runChangeName, setRunChangeName] = useState("");
  const [runOpenedFrom, setRunOpenedFrom] = useState<"editor" | "pipeline">("editor");
  const [pipelineChain, setPipelineChain] = useState<{ changeDir: string; budget: HarnessBudget | undefined } | null>(null);
  const pipelineRunLayer = useRef<HTMLDivElement | null>(null);
  const pipelineRunShown = runOpenedFrom === "pipeline" && runDispatch !== null ? "dialog" : pipelineChain ? "chain" : "none";
  // A person pressed Start on a card, and what it opened is not beside the
  // card: focus moves into it, so the keyboard and a screen reader follow.
  useEffect(() => {
    if (pipelineRunShown === "none") return;
    pipelineRunLayer.current?.querySelector<HTMLElement>('[role="dialog"]')?.focus();
  }, [pipelineRunShown]);
  const [timelineSelection, setTimelineSelection] = useState("");
  const [timeline, setTimeline] = useState<ChangeTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineMessage, setTimelineMessage] = useState<string | null>(null);
  /** Counts timeline readings, so a change chosen after another is not
   * replaced by the first one's answer arriving late. */
  const timelineReading = useRef(0);
  const [timelineMode, setTimelineMode] = useState<"single" | "multi" | "sprint">("single");
  const [sprintReportLoading, setSprintReportLoading] = useState(false);
  const [sprintReportMessage, setSprintReportMessage] = useState<string | null>(null);
  const [staleThresholdDays, setStaleThresholdDays] = useState(DEFAULT_STALE_TASK_THRESHOLD_DAYS);
  const [multiRangeStart, setMultiRangeStart] = useState("");
  const [multiRangeEnd, setMultiRangeEnd] = useState("");
  const [multiSelection, setMultiSelection] = useState<string[]>([]);
  /* The comparison (the-timeline-compares-changes): the spans read in one
     pass, the toolbar's period and filter, and the histories its charts
     rest on, kept by change so a period changed twice reads nothing
     twice. */
  const [spans, setSpans] = useState<ChangeSpan[] | null>(null);
  const [spansLoading, setSpansLoading] = useState(false);
  const [spansMessage, setSpansMessage] = useState<string | null>(null);
  const [comparisonNow, setComparisonNow] = useState(() => Date.now());
  const [comparisonPeriod, setComparisonPeriod] = useState<ComparisonPeriodId>(DEFAULT_COMPARISON_PERIOD);
  const [comparisonFilter, setComparisonFilter] = useState("");
  const [comparisonCharts, setComparisonCharts] = useState<ChangeTimeline[]>([]);
  const [comparisonChartsReading, setComparisonChartsReading] = useState(0);
  const [comparisonChartsError, setComparisonChartsError] = useState<string | null>(null);
  /** The histories already read, by `archived:name`, read inside an effect
   * that must not re-run each time one arrives. */
  const comparisonHeld = useRef<Map<string, ChangeTimeline>>(new Map());
  /** Counts chart readings, so a period changed while one is in flight is
   * not overwritten by its answer, as `timelineReading` does above. */
  const comparisonReading = useRef(0);
  const [initTools, setInitTools] = useState<string[]>(["github-copilot"]);
  const [initLoading, setInitLoading] = useState(false);
  const [initMessage, setInitMessage] = useState<string | null>(null);
  const [archivedTemplateSource, setArchivedTemplateSource] = useState("");
  const [archivedTemplateLoading, setArchivedTemplateLoading] = useState(false);
  const [archivedTemplateMessage, setArchivedTemplateMessage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<{ builtIn: CatalogTemplate[]; project: CatalogTemplate[] } | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [templateVariableValues, setTemplateVariableValues] = useState<Record<string, string>>({});
  const [templateInsertTargetChange, setTemplateInsertTargetChange] = useState("");
  const [templateActionLoading, setTemplateActionLoading] = useState(false);
  const [templateActionMessage, setTemplateActionMessage] = useState<string | null>(null);
  const [workspaceRootSyncError, setWorkspaceRootSyncError] = useState<string | null>(null);
  const [detectedAgents, setDetectedAgents] = useState<Record<string, boolean> | undefined>(undefined);
  // Global harness config only (no changeName) — the standalone shell has
  // no per-change context at this level the way VS Code's panel does when
  // opened from a specific change in the tree (see openspec/changes/
  // agentic-harness/design.md). Still a real, useful repo-wide default.
  const [stepAgents, setStepAgents] = useState<HarnessStepAgents | undefined>(undefined);
  const [versions, setVersions] = useState<WorkbenchVersions | null>(null);
  // What the three views that keep their loading inside are reading
  // (a-screen-says-what-it-is-doing). React keeps a state setter stable, so
  // each is passed as the view's callback directly.
  const [processesReading, setProcessesReading] = useState<string | null>(null);
  const [harnessReading, setHarnessReading] = useState<string | null>(null);
  /** Whether Harness Settings shows the file Save would write, from its page
   * head's action (the-harness-settings-look-like-the-mockup). */
  const [harnessFileShown, setHarnessFileShown] = useState(false);
  const [pipelineReading, setPipelineReading] = useState<string | null>(null);
  const transport = useMemo(() => new FetchTransport({ baseUrl: window.location.origin, accessToken }), []);
  const processesApi = useMemo<ProcessesApi>(() => {
    async function request<T>(pathname: string, body: Record<string, unknown>): Promise<T> {
      const response = await apiFetch(pathname, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd, ...body }),
      });
      const payload = await response.json().catch(() => ({})) as T & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
      return payload;
    }
    return {
      list: () => request("/api/processes/list", {}),
      details: (processId) => request("/api/processes/details", { processId }),
      rollback: (processId) => request("/api/processes/rollback", { processId }),
      cleanup: (cutoff) => request("/api/processes/cleanup", { cutoff }),
    };
  }, [cwd]);

  const harnessSettingsApi = useMemo<HarnessSettingsApi>(() => ({
    listCustomAgents: () => loadCustomAgents(apiFetch, cwd),
    resolveGlobal: () => resolveHarnessConfigApi(apiFetch, cwd),
    writeGlobal: (config) => writeHarnessConfigApi(apiFetch, cwd, config),
    readChangeOverride: (changeName) => readChangeHarnessOverrideApi(apiFetch, cwd, changeName),
    writeChangeOverride: (changeName, config) => writeHarnessConfigApi(apiFetch, cwd, config, changeName),
  }), [cwd]);

  // Stable across renders so the pipeline's polling effect is not torn
  // down and restarted on every one of them.
  const pipelineLoad = useCallback(() => loadChangeReadiness(apiFetch, cwd), [cwd]);
  const pipelineSurvey = useCallback(() => loadWorktreeSurvey(apiFetch, cwd), [cwd]);
  const pipelineLastRuns = useCallback(() => loadChangeLastRuns(apiFetch, cwd), [cwd]);
  const pipelineStandings = useCallback(() => loadChangeStandings(apiFetch, cwd), [cwd]);
  // The runs this server holds, and what a card sends for them over the
  // socket every run here already uses (a-change-is-run-from-its-card).
  const pipelineLiveRuns = useCallback(() => loadLiveRuns(apiFetch, cwd), [cwd]);
  // A card's Stop on a run held elsewhere: the server checks the run is live
  // and writes the signed request with its own key
  // (a-run-elsewhere-can-be-asked-to-stop). A refusal changes nothing on the
  // card, which goes on to say the run has not read a request.
  const pipelineAskToStop = useCallback((request: AskToStop) => {
    void askRunToStopRequest(apiFetch, cwd, request.instanceId, request.reason).catch(() => undefined);
  }, [cwd]);
  // What the folded row presses: the changes it named, archived one after
   // another by the server, and the readings taken again so the picture
   // stops drawing what is now in the archive
   // (what-is-finished-is-tidied-away).
  const pipelineArchive = useCallback((changeNames: string[]) => {
    void (async () => {
      try {
        const response = await apiFetch("/api/changes/archive", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cwd, changeNames }),
        });
        const payload = (await response.json().catch(() => ({}))) as { failures?: Array<{ changeName: string; reason: string }> };
        const failures = payload.failures ?? [];
        setScheduleMessage(failures.length === 0
          ? `Archived ${changeNames.length === 1 ? changeNames[0] : `${changeNames.length} changes`}.`
          : `Archived ${changeNames.length - failures.length} of ${changeNames.length}; ${failures.map((one) => `${one.changeName}: ${one.reason}`).join("; ")}`);
      } catch (error) {
        setScheduleMessage(`Could not archive: ${error instanceof Error ? error.message : String(error)}`);
      }
      await loadOverviewFor(cwd);
    })();
  }, [cwd]);
  const pipelineRunControl = useCallback((control: RunControl) => {
    transport.send({
      kind: control.kind,
      cwd,
      runId: control.runId,
      context: { changeDir: `${cwd.replace(/[\\/]+$/u, "")}/openspec/changes/${control.changeName}` },
      ...(control.reason !== undefined ? { reason: control.reason } : {}),
      ...(control.permissionRequestId !== undefined ? { permissionRequestId: control.permissionRequestId } : {}),
      ...(control.permissionOutcome !== undefined ? { permissionOutcome: control.permissionOutcome } : {}),
    });
  }, [cwd, transport]);
  const pipelineCopyText = useCallback((text: string) => navigator.clipboard.writeText(text), []);
  // `handleRunWithHarness` is a hoisted declaration further down and reads
  // `cwd` itself, as `loadChangeEditor` does for `openChangeInEditor` below.
  const pipelineStart = useCallback((changeName: string) => {
    void handleRunWithHarness(changeName, "pipeline");
  }, [cwd]);
  // The zoom and the open cards, for this browser. Storage a browser
  // refuses leaves the default zoom and every card closed
  // (a-card-opens-to-its-tasks).
  const pipelineViewState = useMemo(() => ({
    read: (): PipelineViewMemory | undefined => {
      try {
        const saved = window.localStorage.getItem(PIPELINE_VIEW_STORAGE_KEY);
        return saved === null ? undefined : JSON.parse(saved) as PipelineViewMemory;
      } catch {
        return undefined;
      }
    },
    write: (memory: PipelineViewMemory) => {
      try {
        window.localStorage.setItem(PIPELINE_VIEW_STORAGE_KEY, JSON.stringify(memory));
      } catch {
        // Not kept; the picture is drawn all the same.
      }
    },
  }), []);
  // Fetches refs now and says how fresh they are; the Pipeline then reads
  // again (a-change-says-where-it-stands).
  const pipelineRefresh = useCallback(
    async () => describeStandingSources((await loadChangeStandings(apiFetch, cwd, "now")).sources),
    [cwd],
  );

  // `loadChangeEditor` is a hoisted declaration further down and reads
  // `cwd` itself, so `cwd` is the only thing this has to be rebuilt for.
  //
  // Embedded in the VS Code Pipeline panel (the-pipeline-answers-while-a-
  // run-works), the shell shows no Change Editor tab to switch to — the
  // host has its own editor and tree for that. There, opening a card posts
  // `openspec-ui/open-change` to the embedding panel instead, which relays
  // it (after checking its own origin) to `revealChange`.
  const openChangeInEditor = useCallback((changeName: string) => {
    if (!isStandaloneHost) {
      window.parent.postMessage({ type: "openspec-ui/open-change", changeName }, "*");
      return;
    }
    setActiveTab("change-editor");
    void loadChangeEditor(changeName);
  }, [cwd]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const workspaceRoot = await loadWorkspaceRoot();
        if (cancelled) return;
        setCwd(workspaceRoot);
        setChangeDir(buildDefaultChangeDir(workspaceRoot));
        setWorkspaceRootSyncError(null);
        // Opening the application is enough. This used to stop at the
        // root field, and the overview was loaded only when someone left
        // that field, pressed "Load summary" or saved something — so a
        // schedule, which correctly refuses to read until the changes
        // are known, refused forever. The dialog promised "the run
        // starts the next time you open it" and it did not.
        // See a-schedule-keeps-its-promise.
        if (!cancelled) await loadOverviewFor(workspaceRoot);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setWorkspaceRootSyncError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isStandaloneHost) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiFetch("/api/versions", { method: "GET" });
        if (!response.ok) return;
        const payload = (await response.json()) as WorkbenchVersions;
        if (!cancelled) setVersions(payload);
      } catch {
        // Version display is informational, not required for the app to work.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cwd.trim().length === 0) return;
    writeStoredValue(STORAGE_KEYS.cwd, cwd);
  }, [cwd]);

  useEffect(() => {
    if (changeDir.trim().length === 0) return;
    writeStoredValue(STORAGE_KEYS.changeDir, changeDir);
  }, [changeDir]);

  /** Re-reads the workspace when the root field is left, and only when
   * it names a different root than the overview on screen. The button
   * beside it stays an unconditional reload — that one is asked for. */
  async function handleRootBlur() {
    if (cwd.trim().length === 0 || cwd === overviewRoot.current) return;
    await handleLoadOverview();
  }

  function handleCwdChange(nextCwd: string) {
    setCwd(nextCwd);
    setChangeDir(buildDefaultChangeDir(nextCwd));
  }

  async function loadDiff(changeName: string) {
    const reading = ++diffReading.current;
    setDiffChangeName(changeName);
    setDiffAnswer(null);
    setDiffError(null);
    if (changeName.length === 0) {
      setDiffLoading(false);
      return;
    }
    setDiffLoading(true);
    try {
      const answer = await loadChangeDiff(apiFetch, cwd, changeName);
      if (reading === diffReading.current) setDiffAnswer(answer);
    } catch (error) {
      if (reading === diffReading.current) setDiffError(error instanceof Error ? error.message : String(error));
    } finally {
      if (reading === diffReading.current) setDiffLoading(false);
    }
  }

  async function handleLoadOverview() {
    if (cwd.trim().length === 0) {
      setOverviewError("Enter a workspace root before loading overview.");
      return;
    }
    await loadOverviewFor(cwd);
  }

  /** What the workspace was left holding, read beside the summary. The
   * reading sweeps first, so what the product itself left behind is gone
   * by the time the Summary draws and is named there rather than left to
   * be noticed (the-workspace-clears-what-it-left-behind). A failure is
   * its own line, not the summary's.  */
  async function readLeftoversFor(root: string) {
    try {
      setLeftovers(await loadWorkspaceLeftovers(apiFetch, root));
      setLeftoversError(undefined);
    } catch (error) {
      setLeftovers(undefined);
      setLeftoversError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRemoveLeftover(target: { name: string } | { path: string }) {
    try {
      await removeWorkspaceLeftover(apiFetch, cwd, target);
      await readLeftoversFor(cwd);
    } catch (error) {
      setLeftoversError(error instanceof Error ? error.message : String(error));
    }
  }

  /** What readiness says about each change, for the Changes list's words.
   * A reading that fails leaves the words without it rather than taking
   * the summary down with it: the same trade the standings reading makes. */
  async function readReadinessFor(root: string) {
    try {
      setChangeReadiness(await loadChangeReadiness(apiFetch, root));
    } catch {
      setChangeReadiness(null);
    }
  }

  /** Reads the files again and fetches refs now, whatever the fetch
   * interval. A second press while one is under way starts nothing
   * (a-change-says-where-it-stands). */
  async function refreshStandings() {
    if (standingsRefreshing || cwd.trim().length === 0) return;
    setStandingsRefreshing(true);
    setStandingsError(undefined);
    try {
      setStandings(await loadChangeStandings(apiFetch, cwd, "now"));
      void readReadinessFor(cwd);
      await loadOverviewFor(cwd, { standings: false });
    } catch (error) {
      setStandingsError(error instanceof Error ? error.message : String(error));
    } finally {
      setStandingsRefreshing(false);
    }
  }

  /** Reads the workspace, for a root that is not necessarily in state
   * yet — the open path has just learned it from the server and React
   * has not re-rendered. The blur and the "Load summary" button call the
   * same thing, as reloads. */
  async function loadOverviewFor(root: string, options: { standings?: boolean } = {}) {
    overviewRoot.current = root;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const response = await apiFetch("/api/overview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd: root }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        const message = payload.error ?? `${response.status} ${response.statusText}`;
        throw new Error(message);
      }

      const payload = (await response.json()) as OpenSpecOverview;
      setOverview(payload);
      // Where each change stands, read beside the summary and fetching only
      // where refs are older than the interval. A reading that fails is said
      // beside the list and costs the summary nothing. A refresh has just
      // read it with a fetch, and does not read it twice.
      if (options.standings !== false) {
        void loadChangeStandings(apiFetch, root)
          .then((reading) => {
            setStandings(reading);
            setStandingsError(undefined);
          })
          .catch((error: unknown) => setStandingsError(error instanceof Error ? error.message : String(error)));
        void readReadinessFor(root);
      }
      void readLeftoversFor(root);
      // Read beside the summary, and its failure is its own: a workspace
      // whose task files cannot be read still has a summary worth
      // showing, and losing that to this would be a worse trade.
      try {
        setHumanOnly({ status: "loaded", inbox: await loadHumanOnlyInbox(apiFetch, root) });
      } catch (error) {
        // Kept as a state with a reason, not dropped to `null`: an
        // absent block is what "not loaded yet" looks like, and this is
        // not that. See a-check-that-passes-checked-something.
        setHumanOnly({ status: "failed", reason: error instanceof Error ? error.message : String(error) });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOverviewError(message);
      setOverview(null);
      // Forgotten, so leaving the field retries rather than trusting a
      // reading that never arrived.
      overviewRoot.current = null;
    } finally {
      setOverviewLoading(false);
    }
  }

  async function loadChangeEditor(changeName: string) {
    if (cwd.trim().length === 0) {
      setEditorMessage("Enter workspace root first.");
      return;
    }
    setEditorLoading(true);
    setEditorMessage(null);
    try {
      const payload = await loadChangeEditorDocument(apiFetch, cwd, changeName);
      setEditorFiles(payload.files ?? EMPTY_EDITOR_FILES);
      setEditorRevision(payload.revision);
      setEditorChangeName(changeName);
      unsavedChange.current = null;
      setEditorMessage(`Loaded ${changeName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEditorMessage(`Load failed: ${message}`);
    } finally {
      setEditorLoading(false);
    }
  }

  /** The one way in, for this host (one-way-in-to-run). Resolves the
   * change's harness config fresh on every click (never cached, see
   * agentic-harness-run-menu's design.md) and then *shows* what it
   * resolved rather than acting on it silently.
   *
   * It used to dispatch immediately: `assisted` switched to the "Run a
   * Command" tab, anything else revealed the chain panel. Both were
   * correct and neither said so, which is why the button looked like it
   * only changed tabs. */
  async function handleRunWithHarness(changeName: string = editorChangeName, from: "editor" | "pipeline" = "editor") {
    if (cwd.trim().length === 0 || changeName.trim().length === 0) return;
    // Set first, so a failure is said where the person pressed the button.
    setRunOpenedFrom(from);
    setRunHarnessLoading(true);
    setRunHarnessMessage(null);
    // A person opened this one, so no schedule explains it. The note
    // used to survive, and reappeared here saying a run had been
    // scheduled that nobody had scheduled.
    setRunNote(null);
    setRunAppliedNote(null);
    setRunUseAgentNote(null);
    try {
      const dispatch = await resolveRunWithHarnessDispatch(apiFetch, cwd, changeName);
      // Where the change stands, with refs fetched now, so the dialog asks
      // about fresh refs. A reading that fails leaves the dialog as it was.
      const reading = await loadChangeStandings(apiFetch, cwd, "now").catch(() => undefined);
      const standing = reading?.standings.find((candidate) => candidate.changeName === changeName);
      setRunStanding(standing ? describeChangeState({ standing }) : undefined);
      setRunChangeName(changeName);
      setRunDispatch(dispatch);
      // Absent rather than zeroed if it cannot be read. Zeroes would be a
      // claim about this workspace; absence is the truth about the read.
      setRunStats(await loadWorkspaceRunStats(apiFetch, cwd).catch(() => undefined));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunHarnessMessage(`Run with Agentic Harness failed: ${message}`);
    } finally {
      setRunHarnessLoading(false);
    }
  }

  /** Writes a named configuration to this change and re-reads the plan,
   * so the dialog reflects what it now resolves to rather than what it
   * read before the write.
   *
   * Unlike choosing a path, this does write. A path is chosen for one
   * run; a configuration is chosen until someone changes it, and a
   * recommendation that cannot be acted on is a remark. */
  async function applyTemplateToChange(template: HarnessTemplate) {
    if (!runDispatch) return;
    setRunHarnessLoading(true);
    try {
      await applyTemplateToChangeApi(apiFetch, cwd, runChangeName, template);
      setRunDispatch(await resolveRunWithHarnessDispatch(apiFetch, cwd, runChangeName));
      // Beside the Apply button, in the dialog. It used to be set above
      // the dialog, where the person who pressed Apply could not see it
      // (a-change-is-configured-from-the-change).
      setRunAppliedNote(
        `Applied "${template.title}" to openspec/changes/${runChangeName}/harness.json. `
        + "The dialog now shows what the change resolves to.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunAppliedNote(`Applying "${template.title}" failed: ${message}`);
    } finally {
      setRunHarnessLoading(false);
    }
  }

  /** Puts the agent a run-statistics recommendation names on every stage
   * of this change, then re-reads the plan. A recommendation that cannot
   * be acted on is a remark. */
  async function putAgentOnEveryStage(agentId: string) {
    if (!runDispatch) return;
    setRunHarnessLoading(true);
    try {
      await putAgentOnEveryStageApi(apiFetch, cwd, runChangeName, agentId);
      setRunDispatch(await resolveRunWithHarnessDispatch(apiFetch, cwd, runChangeName));
      setRunUseAgentNote(
        `Put ${agentId} on every stage in openspec/changes/${runChangeName}/harness.json. `
        + "The dialog now shows what the change resolves to.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunUseAgentNote(`Putting ${agentId} on every stage failed: ${message}`);
    } finally {
      setRunHarnessLoading(false);
    }
  }

  /** Starts the path that was picked, which is not always the configured
   * one. Nothing here writes the change's `harness.json`: a run is not a
   * configuration change, and a later run behaving differently for a
   * reason nobody recorded is worse than being asked again. */
  /** Why the dialog opened, when a schedule opened it rather than a
   * person. Cleared on a dismissal and on any start, so a later run does
   * not inherit an explanation that is not its own. */
  const [runNote, setRunNote] = useState<string | null>(null);
  /** What the schedule did, shown in a live region outside the tabs.
   *
   * Separate from `runHarnessMessage`, which belongs to the change
   * editor: a schedule can move a person to another tab, and the reason
   * has to be readable from wherever they land. */
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  /** The root the overview on screen was read for, or is being read
   * for, or `null` when the last reading failed.
   *
   * Leaving the root field re-reads the workspace only when it names a
   * different root. The overview is loaded on open now, and a blur that
   * changed nothing used to start a second reading of the same
   * workspace while the first was still running — two `openspec` CLI
   * processes for one answer. Recorded when the reading starts rather
   * than when it lands, because the blur usually arrives while it is
   * still in flight. */
  const overviewRoot = useRef<string | null>(null);
  /** A schedule pass already running. A pass that outlasts the tick must
   * not be overlapped by the next — the second reading would find the
   * same entry still in the file and open the run twice. */
  const firingInFlight = useRef(false);
  /** The change whose editor content has edits nobody has saved, or
   * `null`. A ref rather than state: the firing effect's closure is from
   * the render that created it, and a stale `false` here would load
   * another change's files over someone's work. */
  const unsavedChange = useRef<string | null>(null);
  /** What is waiting on a person. Read with the summary, because it
   * answers a question about the same list — a change with one unticked
   * human-only item is indistinguishable, in that list, from one nobody
   * has started. See human-only-inbox-in-the-shell. */
  const [humanOnly, setHumanOnly] = useState<HumanOnlyInboxState | null>(null);
  /** Where each change stands across the repository, whether a refresh is
   * under way, and what the run dialog leads with
   * (a-change-says-where-it-stands). */
  const [standings, setStandings] = useState<ChangeStandings | null>(null);
  /** What readiness says about each change, read beside the standings so
   * the list can say a change is blocked. Without it every unfinished
   * change read Ready, whatever the declared order said - reported by DW
   * (a-blocked-change-says-so-where-it-is-listed). */
  const [changeReadiness, setChangeReadiness] = useState<ChangeReadinessReport | null>(null);
  /** What the workspace was left holding, and why the reading failed
   * where it did (the-workspace-clears-what-it-left-behind). */
  const [leftovers, setLeftovers] = useState<WorkspaceLeftoverReading | undefined>(undefined);
  const [leftoversError, setLeftoversError] = useState<string | undefined>(undefined);
  const [standingsRefreshing, setStandingsRefreshing] = useState(false);
  const [standingsError, setStandingsError] = useState<string | undefined>(undefined);
  /** Each change's word on the Changes list, with the runs read again while
   * the summary is shown (the-changes-views-see-a-run-start). */
  const standingStates = useStandingStates(standings, activeTab === "overview", pipelineSurvey, SURVEY_POLL_INTERVAL_MS, changeReadiness);
  const [runStanding, setRunStanding] = useState<DescribedChangeState | undefined>(undefined);
  /** What the last run of each delegated item reported, keyed the way
   * its row is. Shown beside the row it was started from: an outcome
   * that scrolled away somewhere else is an outcome nobody reads. */
  const [delegatedOutcomes, setDelegatedOutcomes] = useState<Record<string, DelegatedOutcome>>({});
  /** The row whose run is in flight, so its button says so and cannot
   * be pressed twice. One item per request is the rule. */
  const [runningDelegated, setRunningDelegated] = useState<string | null>(null);
  /** The key whose enrolment is being confirmed, and what each
   * confirmation reported (a-run-is-signed-by-its-person). */
  const [confirmingEnrolment, setConfirmingEnrolment] = useState<string | null>(null);
  const [enrolmentOutcomes, setEnrolmentOutcomes] = useState<Record<string, string>>({});

  /** Enrols one key, then reads the inbox again: an enrolled key waits no
   * more, and its runs read as signed from then on. */
  async function confirmEnrolment(keyId: string): Promise<void> {
    setConfirmingEnrolment(keyId);
    try {
      const person = await confirmEnrolmentApi(apiFetch, cwd, keyId);
      setEnrolmentOutcomes((current) => ({ ...current, [keyId]: `Enrolled as ${person.label}.` }));
      try {
        setHumanOnly({ status: "loaded", inbox: await loadHumanOnlyInbox(apiFetch, cwd) });
      } catch {
        // The enrolment stands; a failed refresh does not undo it.
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setEnrolmentOutcomes((current) => ({ ...current, [keyId]: `Not enrolled: ${reason}` }));
    } finally {
      setConfirmingEnrolment(null);
    }
  }

  /** Runs the agent one open delegated item names, and reports the
   * outcome — including a refusal from the rubber-stamp gate — where
   * the row is. The reading is then refreshed, because the run may have
   * closed the item or written under it. */
  async function runDelegatedItem(item: { changeName: string; lineNumber: number }): Promise<void> {
    const key = `${item.changeName}:${item.lineNumber}`;
    setRunningDelegated(key);
    try {
      const result = await runDelegatedItemApi(apiFetch, cwd, item);
      // What the agent last said travels with the message, so a failed run
      // shows why it stopped beside the row rather than only an exit code
      // (a-delegated-run-says-what-happened).
      const lastStderr = result.status === "ran" ? result.lastStderr : undefined;
      setDelegatedOutcomes((current) => ({
        ...current,
        [key]: { message: result.message, ...(lastStderr !== undefined ? { lastStderr } : {}) },
      }));
      try {
        setHumanOnly({ status: "loaded", inbox: await loadHumanOnlyInbox(apiFetch, cwd) });
      } catch {
        // The run's own outcome is the answer here; a failed refresh of
        // the list does not make it less true, and overwriting the
        // block with a read error would hide it.
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setDelegatedOutcomes((current) => ({ ...current, [key]: { message: `The run could not be started: ${reason}` } }));
    } finally {
      setRunningDelegated(null);
    }
  }

  /** Asks for a run at a time. The dialog closes: what happens next is a
   * schedule, not a run, and leaving the run buttons on screen would
   * suggest otherwise. */
  async function scheduleRun(path: RunPathId, startAt: string) {
    if (!runDispatch) return;
    const name = runChangeName;
    setRunDispatch(null);
    setRunNote(null);
    try {
      await addScheduledRunApi(apiFetch, cwd, {
        changeName: name,
        path,
        startAt,
        requestedAt: new Date().toISOString(),
      });
      setRunHarnessMessage(`Scheduled ${name} for ${new Date(startAt).toLocaleString()}.`);
    } catch (error) {
      setRunHarnessMessage(`Scheduling failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Starts the path that was picked.
   *
   * `dispatch` is passed when a schedule starts the run: the state has
   * only just been set and this render still holds the old value. */
  function startChosenRun(path: RunPathId, dispatch: RunWithHarnessDispatch | null = runDispatch) {
    if (!dispatch) return;
    const { changeDir: targetChangeDir, budget } = dispatch;
    // Chosen in the dialog a Pipeline card's Start opened, and not by a
    // schedule, which passes a dispatch of its own
    // (a-change-is-run-from-its-card).
    const fromPipeline = runOpenedFrom === "pipeline" && dispatch === runDispatch;
    setRunDispatch(null);
    // A lateness note belongs to the run it explained. Left standing, it
    // reappeared over the next dialog a person opened themselves, which
    // said a schedule had started something that nobody scheduled.
    setRunNote(null);
    if (path === "chain" && fromPipeline) {
      // The chain runs in the Pipeline's layer, where Start was pressed.
      setPipelineChain({ changeDir: targetChangeDir, budget });
      return;
    }
    setRunOpenedFrom("editor");
    if (path === "chain") {
      setChainChangeDir(targetChangeDir);
      setChainBudget(budget);
      setActiveTab("change-editor");
      return;
    }
    setChainChangeDir(null);
    setChangeDir(targetChangeDir);
    setActiveTab("run-a-command");
  }

  /** Closes the run a Pipeline card opened, and gives focus back to that
   * card's Start, where the person was (a-change-is-run-from-its-card). */
  function closePipelineRun() {
    const name = runChangeName;
    setRunDispatch(null);
    setRunNote(null);
    setPipelineChain(null);
    setRunOpenedFrom("editor");
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-testid="pipeline-start-${CSS.escape(name)}"]`)?.focus();
    }, 0);
  }

  /** Acts on a schedule that has come due.
   *
   * Nothing here decides anything about the schedule: `fireDueSchedule`
   * does, over `planScheduleFiring` in core, and this supplies the
   * effects. The same loop used to be written here and again in the
   * extension's watcher, and the two had already diverged in how they
   * wrote back and in what they did with an archived change.
   *
   * The run starts on the path the entry named rather than reopening a
   * dialog to be answered again — the choice was made when the run was
   * asked for. See a-schedule-keeps-its-promise. */
  async function fireDueRuns() {
    if (cwd.trim().length === 0 || runDispatch) return;
    // Not until the workspace's changes are known. Without this the
    // first pass ran with an empty list, decided every scheduled change
    // had been deleted, and removed the entries — losing a schedule to
    // not having read yet. Absence of knowledge is not evidence of
    // absence, and here it was destructive.
    if (!overview) return;
    // A pass that outlasts the tick is not overlapped by the next: the
    // second reading would find the same entry still in the file.
    if (firingInFlight.current) return;
    firingInFlight.current = true;

    const host: ScheduleFiringHost = {
      loadEntries: () => loadScheduledRuns(apiFetch, cwd),
      removeEntry: (entry) => removeScheduledRunApi(apiFetch, cwd, entry),
      resolveDispatch: (changeName) => resolveRunWithHarnessDispatch(apiFetch, cwd, changeName),
      loadChange: async (changeName) => {
        const dirty = unsavedChange.current;
        if (dirty && dirty !== changeName) {
          return `${dirty} has unsaved edits, so the editor was left on it. Save or reload it, then choose a path.`;
        }
        // The same load a manual selection takes. Pointing the editor at
        // a change without loading it left the previous change's files
        // and revision on screen under the new name, and saving then
        // posted one change's edits under another's.
        await loadChangeEditor(changeName);
        return undefined;
      },
      startRun: (path, dispatch) => startChosenRun(path, dispatch),
      openDialog: (dispatch, note) => {
        // The dialog lives in the change editor, and a tab that is not
        // active is not rendered. Without this the schedule fired and
        // nothing appeared.
        setActiveTab("change-editor");
        setRunNote(note);
        setRunDispatch(dispatch);
      },
      say: setScheduleMessage,
    };

    try {
      await fireDueSchedule(host, {
        active: (overview?.changes ?? []).map((change) => change.name),
        archived: overview?.archivedChanges ?? [],
      }, new Date());
    } finally {
      firingInFlight.current = false;
    }
  }

  useEffect(() => {
    if (!isStandaloneHost) return;
    void fireDueRuns();
    // A minute is the resolution a person schedules at; polling faster
    // would read a file more often to learn the same thing.
    const timer = setInterval(() => void fireDueRuns(), 60_000);
    return () => clearInterval(timer);
  }, [cwd, overview, runDispatch]);

  /** Reads the chosen change's timeline. Choosing a change calls this; there
   * is no button to press (the-change-timeline-looks-like-the-mockup). */
  async function loadTimeline(selection: string) {
    if (cwd.trim().length === 0) {
      setTimelineMessage("Enter workspace root first.");
      return;
    }
    const [prefix, ...rest] = selection.split(":");
    const changeName = rest.join(":");
    if (!changeName || (prefix !== "active" && prefix !== "archived")) {
      setTimelineMessage("Select a change first.");
      return;
    }
    const reading = ++timelineReading.current;
    setTimelineLoading(true);
    setTimelineMessage(null);
    try {
      const loaded = await loadChangeTimeline(apiFetch, cwd, changeName, prefix === "archived");
      if (reading === timelineReading.current) setTimeline(loaded);
    } catch (error) {
      if (reading !== timelineReading.current) return;
      const message = error instanceof Error ? error.message : String(error);
      setTimelineMessage(`Load failed: ${message}`);
      setTimeline(null);
    } finally {
      if (reading === timelineReading.current) setTimelineLoading(false);
    }
  }

  function decodeSelection(selection: string): ChangeTimelineEntry | undefined {
    const [prefix, ...rest] = selection.split(":");
    const changeName = rest.join(":");
    if (!changeName || (prefix !== "active" && prefix !== "archived")) return undefined;
    return { changeName, archived: prefix === "archived" };
  }

  /** Reads when every change was proposed and archived, in one pass. The
   * comparison draws from this alone; the histories its charts rest on
   * follow (the-timeline-compares-changes). */
  async function loadSpans() {
    if (cwd.trim().length === 0) {
      setSpansMessage("Enter workspace root first.");
      return;
    }
    setSpansLoading(true);
    setSpansMessage(null);
    try {
      const read = await loadChangeSpans(apiFetch, cwd);
      setSpans(read.spans);
      // Now is read with the dates, so the dashed line and an active
      // change's bar end at the same instant.
      setComparisonNow(Date.now());
      comparisonHeld.current = new Map();
      setComparisonCharts([]);
      setComparisonChartsError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSpansMessage(`Read failed: ${message}`);
      setSpans(null);
    } finally {
      setSpansLoading(false);
    }
  }

  /** Opens one change's own timeline from its row in the comparison, as
   * choosing it in the picker would. */
  function openTimelineOf(changeName: string, archived: boolean) {
    const selection = `${archived ? "archived" : "active"}:${changeName}`;
    setTimelineMode("single");
    setTimelineSelection(selection);
    timelineReading.current += 1;
    setTimeline(null);
    setTimelineMessage(null);
    void loadTimeline(selection);
  }

  async function downloadSprintReport() {
    if (cwd.trim().length === 0) {
      setSprintReportMessage("Enter workspace root first.");
      return;
    }
    if (multiRangeStart.trim().length === 0 || multiRangeEnd.trim().length === 0) {
      setSprintReportMessage("Select a date range first.");
      return;
    }
    const entries = multiSelection.map(decodeSelection).filter((entry): entry is ChangeTimelineEntry => Boolean(entry));
    if (entries.length === 0) {
      setSprintReportMessage("Select at least one change first.");
      return;
    }
    setSprintReportLoading(true);
    setSprintReportMessage(null);
    try {
      const rangeStart = new Date(multiRangeStart).toISOString();
      const rangeEnd = new Date(multiRangeEnd).toISOString();
      const pdfBlob = await fetchSprintReportPdf(apiFetch, cwd, entries, rangeStart, rangeEnd);
      const objectUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `sprint-report-${multiRangeStart}-${multiRangeEnd}.pdf`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSprintReportMessage(`Generate failed: ${message}`);
    } finally {
      setSprintReportLoading(false);
    }
  }

  async function handleInsertTasksTemplate() {
    if (cwd.trim().length === 0 || editorChangeName.trim().length === 0) {
      setArchivedTemplateMessage("Load a non-archived change first.");
      return;
    }
    if (archivedTemplateSource.trim().length === 0) {
      setArchivedTemplateMessage("Select an archived change first.");
      return;
    }

    setArchivedTemplateLoading(true);
    setArchivedTemplateMessage(null);
    try {
      const template = await loadArchivedTasksTemplate(apiFetch, cwd, archivedTemplateSource);
      setEditorFiles((prev) => ({ ...prev, tasks: mergeTasksTemplate(prev.tasks, template) }));
      setArchivedTemplateMessage(`Inserted tasks template from ${archivedTemplateSource}. Review and save.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setArchivedTemplateMessage(`Insert failed: ${message}`);
    } finally {
      setArchivedTemplateLoading(false);
    }
  }

  const changeProgress = useMemo(
    () =>
      Object.fromEntries(
        (overview?.changes ?? []).map((change) => [
          change.name,
          { completedTasks: change.completedTasks, totalTasks: change.totalTasks },
        ]),
      ),
    [overview],
  );

  const allTemplates: Array<CatalogTemplate & { key: string }> = templates
    ? [...templates.builtIn, ...templates.project]
      .map((t) => ({ ...t, key: `${t.origin}:${t.manifest.id}` }))
      .sort(
        (a, b) =>
          a.manifest.category.localeCompare(b.manifest.category) ||
          a.manifest.title.localeCompare(b.manifest.title),
      )
    : [];
  const selectedTemplate = allTemplates.find((t) => t.key === selectedTemplateKey);

  function isTemplateCustomized(builtInId: string): boolean {
    return (templates?.project ?? []).some((t) => t.manifest.forkedFrom?.id === builtInId);
  }

  async function handleRefreshAgents() {
    try {
      setDetectedAgents(await detectAgentsApi(apiFetch, cwd));
    } catch {
      // Detection is a best-effort annotation, not a required signal — leave
      // the picker unannotated (previous result, or none) on failure.
    }
  }

  // Only wired up in the real standalone host (isStandaloneHost), not the
  // VS Code local-server iframe embed: that host already gets a native
  // notification from the extension side (run-notifications.ts) once the
  // command/event stream reaches it, and browser Notification permission is
  // unreliable inside a webview iframe anyway. Requests permission lazily
  // on first use rather than unprompted on load; if permission is not yet
  // granted by the time a run finishes, that one run's notification is
  // silently skipped (request stays in flight for the next one) — no
  // notification is ever shown without the browser actually granting it.
  function handleRunTerminal(commandKind: CommandKind, event: Event) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
      return;
    }
    if (Notification.permission !== "granted") return;
    const notification = describeRunCompletionNotification(commandKind, event);
    if (notification) new Notification(notification.title, { body: notification.body });
  }

  useEffect(() => {
    if (cwd.trim().length === 0 || changeDir.trim().length === 0) return;
    void handleRefreshAgents();
  }, [cwd, changeDir]);

  useEffect(() => {
    if (cwd.trim().length === 0) {
      setStepAgents(undefined);
      return;
    }
    resolveHarnessConfigApi(apiFetch, cwd)
      .then((config) => {
        // Passed through as resolved, not flattened to agent ids — the
        // object form carries the stage's model, which AiPanel needs for
        // the `Command` it sends (harness-step-models tasks.md section 9).
        setStepAgents(config.stepAgents);
      })
      .catch(() => {
        // No harness config, or a malformed one — the picker simply falls
        // back to no recommendation (surfaced separately by Harness
        // Settings, not this best-effort pre-fill).
        setStepAgents(undefined);
      });
  }, [cwd]);

  async function handleLoadTemplates() {
    if (cwd.trim().length === 0) {
      setTemplatesError("Enter workspace root first.");
      return;
    }
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      setTemplates(await listTemplatesApi(apiFetch, cwd));
    } catch (error) {
      setTemplatesError(error instanceof Error ? error.message : String(error));
      setTemplates(null);
    } finally {
      setTemplatesLoading(false);
    }
  }

  function handleSelectTemplate(template: CatalogTemplate & { key: string }) {
    setSelectedTemplateKey(template.key);
    setTemplateVariableValues(
      Object.fromEntries(
        template.manifest.variables.map((v) => [v.name, v.default !== undefined ? String(v.default) : ""]),
      ),
    );
    setTemplateActionMessage(null);
  }

  async function handleCustomizeTemplate(builtInId: string) {
    if (cwd.trim().length === 0) {
      setTemplateActionMessage("Enter workspace root first.");
      return;
    }
    setTemplateActionLoading(true);
    setTemplateActionMessage(null);
    try {
      await customizeTemplateApi(apiFetch, cwd, builtInId);
      setTemplateActionMessage(`Customized ${builtInId} into openspec/templates/${builtInId}/.`);
      await handleLoadTemplates();
    } catch (error) {
      setTemplateActionMessage(`Customize failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTemplateActionLoading(false);
    }
  }

  async function handleDeleteProjectTemplate(id: string) {
    if (cwd.trim().length === 0) {
      setTemplateActionMessage("Enter workspace root first.");
      return;
    }
    if (!window.confirm(`Permanently delete project template "${id}"?`)) return;

    setTemplateActionLoading(true);
    setTemplateActionMessage(null);
    try {
      await deleteProjectTemplateApi(apiFetch, cwd, id);
      setTemplateActionMessage(`Deleted openspec/templates/${id}/.`);
      if (selectedTemplateKey === `project:${id}`) setSelectedTemplateKey("");
      await handleLoadTemplates();
    } catch (error) {
      setTemplateActionMessage(`Delete failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTemplateActionLoading(false);
    }
  }

  async function handleInsertTemplateIntoChange() {
    if (cwd.trim().length === 0) {
      setTemplateActionMessage("Enter workspace root first.");
      return;
    }
    if (!selectedTemplate) {
      setTemplateActionMessage("Select a template first.");
      return;
    }
    if (templateInsertTargetChange.trim().length === 0) {
      setTemplateActionMessage("Select a target change first.");
      return;
    }

    setTemplateActionLoading(true);
    setTemplateActionMessage(null);
    try {
      const rendered = await renderTemplateApi(
        apiFetch,
        cwd,
        selectedTemplate.origin,
        selectedTemplate.manifest.id,
        templateVariableValues,
      );
      const loaded = await loadChangeEditorDocument(apiFetch, cwd, templateInsertTargetChange);
      const mergedFiles: ChangeEditorFiles = {
        proposal: mergeTasksTemplate(loaded.files.proposal, rendered.proposal),
        design: mergeTasksTemplate(loaded.files.design, rendered.design),
        tasks: mergeTasksTemplate(loaded.files.tasks, rendered.tasks),
        spec: loaded.files.spec,
      };
      setEditorFiles(mergedFiles);
      setEditorRevision(loaded.revision);
      setEditorChangeName(templateInsertTargetChange);
      setEditorMessage(`Inserted template "${selectedTemplate.manifest.title}" into ${templateInsertTargetChange}. Review and save.`);
      setActiveTab("change-editor");
    } catch (error) {
      setTemplateActionMessage(`Insert failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTemplateActionLoading(false);
    }
  }

  async function handleCreateChange() {
    if (cwd.trim().length === 0) {
      setEditorMessage("Enter workspace root first.");
      return;
    }
    const changeName = newChangeName.trim();
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(changeName)) {
      setEditorMessage("Change id must match [a-z0-9-].");
      return;
    }

    setEditorCreating(true);
    setEditorMessage(null);
    try {
      const response = await apiFetch("/api/change-editor/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cwd,
          changeName,
          description: newChangeDescription.trim().length > 0 ? newChangeDescription : undefined,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
      }

      setNewChangeName("");
      setNewChangeDescription("");
      await handleLoadOverview();
      await loadChangeEditor(changeName);
      setEditorMessage(`Created ${changeName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEditorMessage(`Create failed: ${message}`);
    } finally {
      setEditorCreating(false);
    }
  }

  async function handleSaveEditor() {
    if (cwd.trim().length === 0 || editorChangeName.trim().length === 0 || editorRevision.length === 0) {
      setEditorMessage("Select and load a change first.");
      return;
    }

    setEditorSaving(true);
    setEditorMessage(null);
    try {
      const saved = await saveChangeEditorDocument(apiFetch, cwd, {
        changeName: editorChangeName,
        files: editorFiles,
        revision: editorRevision,
      });
      setEditorRevision(saved.revision);
      unsavedChange.current = null;

      await handleLoadOverview();
      setEditorMessage(`Saved ${editorChangeName}.`);
    } catch (error) {
      if (error instanceof ChangeEditorSaveConflictError) {
        setEditorMessage("Save conflict: files changed on disk. Your edits are preserved; reload before retrying.");
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setEditorMessage(`Save failed: ${message}`);
    } finally {
      setEditorSaving(false);
    }
  }

  async function handleInitializeOpenSpec() {
    if (cwd.trim().length === 0) {
      setInitMessage("Enter workspace root first.");
      return;
    }
    if (initTools.length === 0) {
      setInitMessage("Select at least one AI tool.");
      return;
    }

    setInitLoading(true);
    setInitMessage(null);
    try {
      const response = await apiFetch("/api/openspec/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd, tools: initTools }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `${response.status} ${response.statusText}`);
      }

      await handleLoadOverview();
      setInitMessage("OpenSpec initialized successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setInitMessage(`Initialization failed: ${message}`);
    } finally {
      setInitLoading(false);
    }
  }

  const canInitialize = Boolean(overview?.initialization?.canInitialize);

  // Which tab is reading, and what it says: a sentence, a spinner on the
  // tab, and its controls held (a-screen-says-what-it-is-doing).
  const readings = tabReadings({
    overviewLoading,
    overviewRead: overview !== null,
    diffLoading,
    diffChangeName,
    editorLoading,
    editorChangeName,
    templatesLoading,
    timelineLoading,
    timelineSelection,
    comparisonLoading: spansLoading,
    sprintReportLoading,
    processesReading,
    harnessReading,
    pipelineReading,
  });
  // Shown only once a reading has lasted a moment: a quick one otherwise
  // put a line above the tab and took it away, and the screen jerked.
  const shownReadings = useShownReadings(readings);
  // The comparison's days and rows, derived by core from the spans the
  // host read (the-timeline-compares-changes). `comparisonAll` is the rows
  // before the filter, for "3 of 25 match".
  const comparisonDays = useMemo(
    () => comparisonWindow(comparisonPeriod, spans ?? [], comparisonNow),
    [comparisonPeriod, spans, comparisonNow],
  );
  const comparisonAll = useMemo(
    () => comparisonRows(spans ?? [], comparisonDays, comparisonNow),
    [spans, comparisonDays, comparisonNow],
  );
  const comparisonShown = useMemo(
    () => comparisonRows(spans ?? [], comparisonDays, comparisonNow, comparisonFilter),
    [spans, comparisonDays, comparisonNow, comparisonFilter],
  );
  /** The rows on screen, as the entries their histories are asked for by.
   * Joined into a string as well, so the effect below re-runs when the rows
   * change rather than each time the array is rebuilt. */
  const comparisonWanted = comparisonShown.map((row) => `${row.active ? "active" : "archived"}:${row.changeName}`);
  const comparisonWantedKey = comparisonWanted.join("|");

  // The spans, once the comparison is on screen and again for another
  // workspace. One pass, and nothing is asked of the reader first.
  useEffect(() => {
    if (activeTab !== "timeline" || timelineMode !== "multi" || cwd.trim().length === 0) return;
    void loadSpans();
  }, [activeTab, timelineMode, cwd]);

  // The histories the charts rest on, for the rows on screen and only for
  // those not read already. The grid is drawn from the spans meanwhile.
  //
  // After a pause, not at once: a history costs about two seconds of git
  // against this repository, and pressing through the periods asked for
  // 16, then 37, then 149, then 266 of them, each read carrying on after
  // its answer was no longer wanted (measured live on 2026-09-18).
  useEffect(() => {
    if (activeTab !== "timeline" || timelineMode !== "multi" || cwd.trim().length === 0) return;
    const held = () => comparisonWanted
      .map((key) => comparisonHeld.current.get(key))
      .filter((timelineHeld): timelineHeld is ChangeTimeline => timelineHeld !== undefined);
    const missing = comparisonWanted
      .filter((key) => !comparisonHeld.current.has(key))
      .map(decodeSelection)
      .filter((entry): entry is ChangeTimelineEntry => Boolean(entry));
    if (missing.length === 0) {
      setComparisonCharts(held());
      return;
    }
    const asked = setTimeout(() => {
      const reading = ++comparisonReading.current;
      setComparisonChartsReading(missing.length);
      void loadChangeTimelines(apiFetch, cwd, missing)
        .then((loaded) => {
          if (reading !== comparisonReading.current) return;
          for (const read of loaded) {
            comparisonHeld.current.set(`${read.archived ? "archived" : "active"}:${read.changeName}`, read);
          }
          setComparisonCharts(held());
          setComparisonChartsError(null);
        })
        .catch((error: unknown) => {
          if (reading !== comparisonReading.current) return;
          const message = error instanceof Error ? error.message : String(error);
          setComparisonChartsError(`The charts could not be read: ${message}`);
        })
        .finally(() => {
          if (reading === comparisonReading.current) setComparisonChartsReading(0);
        });
    }, CHARTS_ASKED_AFTER_MS);
    return () => clearTimeout(asked);
  }, [comparisonWantedKey, activeTab, timelineMode, cwd]);

  // While one change's timeline is shown, the page head names it, as the
  // mockup's artboard does (the-change-timeline-looks-like-the-mockup);
  // over the comparison it says what the grid covers.
  const pageHead = activeTab === "timeline" && timelineMode === "single" && timeline
    ? {
      tagline: "Timeline",
      icon: "timeline" as const,
      title: withoutArchivePrefix(timeline.changeName),
      sentence: `${timeline.archived ? "Archived" : "Active"} · each task placed when git shows it was ticked`,
    }
    : activeTab === "timeline" && timelineMode === "multi" && spans
      ? {
        tagline: "Timeline",
        icon: "timeline" as const,
        title: "Compare changes",
        sentence: describeComparison(comparisonShown, comparisonDays, comparisonNow),
      }
      : PAGE_HEADS[activeTab];

  /** The Timeline's three modes, drawn in whichever toolbar the mode has:
   * its own for one change and the sprint report, the comparison's own for
   * the comparison, which keeps the screen to one row of controls. */
  const timelineModes = (
    <div className="openspec-segmented" role="group" aria-label="Timeline mode">
      <button type="button" aria-pressed={timelineMode === "single"} onClick={() => setTimelineMode("single")}>One change</button>
      <button type="button" aria-pressed={timelineMode === "multi"} onClick={() => setTimelineMode("multi")}>Compare changes</button>
      <button type="button" aria-pressed={timelineMode === "sprint"} onClick={() => setTimelineMode("sprint")}>Sprint report</button>
    </div>
  );
  // Active changes first, then the archive newest first, where a change
  // looked for is most likely to be; the folder's date is searchable too.
  const timelinePickerOptions: ChangePickerOption[] = [
    ...(overview?.changes ?? []).map((change) => ({ value: `active:${change.name}`, name: change.name, archived: false })),
    ...[...(overview?.archivedChanges ?? [])].reverse().map((folder) => ({
      value: `archived:${folder}`,
      name: withoutArchivePrefix(folder),
      archived: true,
      keywords: folder,
    })),
  ];

  return (
    <div className={theme === "dark" ? "openspec-standalone-app openspec-metro dark-side" : "openspec-standalone-app openspec-metro"}>
      <style>{`${metroCss}\n${metroIconsCss}\n${shellThemeCss}`}</style>

      {/* The frame is the standalone shell's alone (ADR 0033 decision 3): the
          VS Code local-server embed shows its one tab without it. */}
      {isStandaloneHost ? <AppBar workspacePath={cwd} theme={theme} onToggleTheme={toggleTheme} /> : null}

      <div className="openspec-page">
      {isStandaloneHost && pageHead ? (
        <PageHead
          head={pageHead}
          action={activeTab === "overview" ? (
            <button className="button openspec-button-quiet" type="button" data-testid="summary-refresh" onClick={handleLoadOverview} disabled={overviewLoading || cwd.trim().length === 0}>
              <Icon meaning="refresh" />Refresh
            </button>
          ) : activeTab === "harness-settings" ? (
            <button
              className="button openspec-button-quiet"
              type="button"
              data-testid="harness-settings-file"
              aria-pressed={harnessFileShown}
              onClick={() => setHarnessFileShown((shown) => !shown)}
              disabled={cwd.trim().length === 0}
            >
              <Icon meaning="open" />agent-harness.json
            </button>
          ) : undefined}
        />
      ) : null}

      {/* Outside the tabs, because a schedule moves a person between
          them: a sentence rendered only inside the change editor was
          unreadable to whoever it had just moved somewhere else, and
          unannounced to a screen reader either way.
          See a-schedule-keeps-its-promise. */}
      <div role="status" aria-live="polite" data-testid="schedule-status">
        {scheduleMessage ? <p className="openspec-shell-note">{scheduleMessage}</p> : null}
      </div>

      <Tabs tabs={visibleTabs} activeTab={activeTab} onSelect={setActiveTab} busy={busyTabs(shownReadings)} />

      <TabPanel id="run-a-command" activeTab={activeTab} lazy>
      {/* The shared components (the-remaining-tabs-wear-metro): where the
          work happens in one panel, initialization in its own, and the run
          itself below them. */}
      <div className="openspec-run-screen">
        <section className="openspec-panel">
          <div className="openspec-panel-head">
            <h2>Where the work happens</h2>
            <span className="openspec-panel-head-note">the workspace every command runs in</span>
          </div>
          <div className="openspec-panel-body">
            <div className="openspec-shell-grid">
              <label className="openspec-shell-field">
                Workspace root (cwd)
                <input
                  type="text"
                  value={cwd}
                  onChange={(e) => handleCwdChange(e.target.value)}
                  onBlur={() => void handleRootBlur()}
                  placeholder="C:\\path\\to\\repo"
                />
              </label>
              <label className="openspec-shell-field">
                Change directory
                <input
                  type="text"
                  value={changeDir}
                  onChange={(e) => setChangeDir(e.target.value)}
                  placeholder="C:\\path\\to\\repo\\openspec\\changes"
                />
              </label>
            </div>
          </div>
          <p className="openspec-panel-fine">
            Changing <strong>Workspace root (cwd)</strong> auto-fills <strong>Change directory</strong> as
            <code> openspec/changes</code>.
            {workspaceRootSyncError ? ` Workspace root sync failed: ${workspaceRootSyncError}` : ""}
          </p>
        </section>

        {canInitialize ? (
          <section className="openspec-panel">
            <div className="openspec-panel-head">
              <h2>This workspace is not initialized</h2>
              <span className="openspec-panel-head-note">OpenSpec initialization artifacts were not found</span>
            </div>
            <div className="openspec-panel-body">
              <label className="openspec-shell-field">
                AI tools for OpenSpec init
                <select
                  multiple
                  size={8}
                  value={initTools}
                  onChange={(e) => {
                    const selected = Array.from(e.currentTarget.selectedOptions).map((option) => option.value);
                    setInitTools(selected);
                  }}
                >
                  {SUPPORTED_INIT_TOOLS.map((tool) => (
                    <option key={tool} value={tool}>
                      {tool}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="openspec-panel-foot">
              <button className="button primary" type="button" onClick={handleInitializeOpenSpec} disabled={initLoading || cwd.trim().length === 0}>
                {initLoading ? "Initializing..." : "Initialize OpenSpec"}
              </button>
              {initMessage ? <span className="openspec-shell-note">{initMessage}</span> : null}
            </div>
          </section>
        ) : null}

        {cwd.trim().length > 0 && changeDir.trim().length > 0 ? (
          <AiPanel
            transport={transport}
            cwd={cwd}
            changeDir={changeDir}
            detectedAgents={detectedAgents}
            stepAgents={stepAgents}
            onRefreshAgents={() => void handleRefreshAgents()}
            onRunTerminal={isStandaloneHost ? handleRunTerminal : undefined}
          />
        ) : (
          <section className="openspec-panel">
            <div className="openspec-panel-head"><h2>Run a command</h2></div>
            <p className="openspec-panel-body openspec-panel-empty">Enter cwd and change directory to enable the AI panel.</p>
          </section>
        )}
      </div>
      </TabPanel>

      {visibleTabIds.has("processes") && (
      <TabPanel id="processes" activeTab={activeTab} lazy>
      <PanelStatus reading={shownReadings["processes"]} testId="tab-reading-processes" />
      <BusyFieldset busy={shownReadings["processes"] !== null}>
      <section className="openspec-shell-panel">
        {cwd.trim().length > 0 ? <ProcessesView api={processesApi} changeProgress={changeProgress} onReadingChange={setProcessesReading} /> : <p>Enter workspace root to load processes.</p>}
      </section>
      </BusyFieldset>
      </TabPanel>
      )}

      {visibleTabIds.has("diff-preview") && (
      <TabPanel id="diff-preview" activeTab={activeTab} lazy>
      <PanelStatus reading={shownReadings["diff-preview"]} testId="tab-reading-diff-preview" />
      <BusyFieldset busy={shownReadings["diff-preview"] !== null}>
      {/* The shared components, as every redrawn tab uses them
          (the-remaining-tabs-wear-metro): the tab's controls in one
          toolbar, and what it read in a panel that names it. */}
      <div className="openspec-diff-screen">
        <div className="openspec-controls" data-testid="diff-toolbar">
          <select
            aria-label="Change to diff"
            data-testid="change-diff-picker"
            value={diffChangeName}
            onChange={(e) => void loadDiff(e.target.value)}
            disabled={(overview?.changes.length ?? 0) === 0}
          >
            <option value="">Select change</option>
            {(overview?.changes ?? []).map((change) => (
              <option key={change.name} value={change.name}>{change.name}</option>
            ))}
          </select>
          <button className="button"
            type="button"
            onClick={() => void loadDiff(diffChangeName)}
            disabled={diffLoading || diffChangeName.length === 0}
          >
            <Icon meaning="refresh" />Refresh
          </button>
          {diffError ? <span className="openspec-shell-note" data-testid="change-diff-error">{diffError}</span> : null}
        </div>

        <section className="openspec-panel" data-testid="change-diff-panel">
          <div className="openspec-panel-head">
            <h2>{diffChangeName.length > 0 ? diffChangeName : "Uncommitted work"}</h2>
            {diffAnswer && diffAnswer.diff.length > 0 ? (
              <span className="openspec-panel-head-note" data-testid="change-diff-files">
                {diffAnswer.files.length === 1 ? "1 file" : `${diffAnswer.files.length} files`} changed
              </span>
            ) : null}
          </div>
          {diffAnswer ? (
            diffAnswer.diff.length === 0 ? (
              <p className="openspec-panel-body openspec-panel-empty" data-testid="change-diff-empty">This change has nothing uncommitted.</p>
            ) : (
              <>
                {/* The files the answer already carries, which the tab
                    only counted before. */}
                <table className="table openspec-table" data-testid="change-diff-file-table">
                  <thead>
                    <tr><th scope="col">File</th></tr>
                  </thead>
                  <tbody>
                    {diffAnswer.files.map((file) => <tr key={file}><td>{file}</td></tr>)}
                  </tbody>
                </table>
                <div className="openspec-panel-body">
                  <ChangeDiff unified={diffAnswer.diff} />
                </div>
                {diffAnswer.truncated ? (
                  <p className="openspec-panel-fine" data-testid="change-diff-truncated">
                    The diff was cut to its first {Math.round(diffAnswer.maxBytes / 1000)} KB; the rest is not shown.
                  </p>
                ) : null}
              </>
            )
          ) : (
            <p className="openspec-panel-body openspec-panel-empty">Choose a change to see what it has changed and not yet committed.</p>
          )}
        </section>
      </div>
      </BusyFieldset>
      </TabPanel>
      )}

      {visibleTabIds.has("overview") && (
      <TabPanel id="overview" activeTab={activeTab} lazy>
      <PanelStatus reading={shownReadings["overview"]} testId="tab-reading-overview" />
      <BusyFieldset busy={shownReadings["overview"] !== null}>
      <div className="openspec-summary">
        {overviewError ? <p className="openspec-notice openspec-overview-error">Failed to load summary: {overviewError}</p> : null}

        {overview ? (() => {
          // What the mockup's summary shows, worked out in one place
          // (the-summary-looks-like-the-mockup).
          const figures = summaryFigures(overview, humanOnly?.status === "loaded" ? humanOnly.inbox.items : null);
          return (
            <div className="openspec-overview" data-testid="openspec-overview">
              <ul className="openspec-overview-tiles" data-testid="overview-tiles">
                {figures.tiles.map((tile) => (
                  <li className="openspec-overview-tile" key={tile.key} data-testid={`overview-tile-${tile.key}`}>
                    <span className="openspec-overview-tile-icon" aria-hidden="true"><Icon meaning={SUMMARY_TILE_ICONS[tile.key]} /></span>
                    <span className="openspec-overview-tile-text">
                      <span className="openspec-overview-tile-label">{tile.label}</span>
                      <strong className="openspec-overview-tile-value">{tile.value}</strong>
                      <span className="openspec-tile-note">{tile.note}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <ChangesList
                changes={overview.changes.map((change) => toChangeSummary(change, toChangeState(change.status)))}
                {...(standings && standingStates
                  ? {
                    states: standingStates,
                    sources: describeStandingSources(standings.sources),
                  }
                  : {})}
                onRefresh={() => void refreshStandings()}
                refreshing={standingsRefreshing}
                {...(standingsError ? { refreshError: standingsError } : {})}
                footnote={<span className="openspec-overview-meta">Workspace read from <strong>{overview.root.path}</strong> ({overview.root.source}).</span>}
              />

              <div className="openspec-summary-pair">
                <SpecsPanel top={figures.topSpecs} all={overview.specs} />
                <RecentlyArchivedPanel
                  recent={figures.recentlyArchived}
                  all={overview.archivedChangeSummaries.map((change) => toChangeSummary(change, "archived"))}
                />
              </div>
            </div>
          );
        })() : null}

        <LeftoverList reading={leftovers} error={leftoversError} onRemove={(target) => void handleRemoveLeftover(target)} />

        {humanOnly ? (
          <section className="openspec-panel openspec-overview-block" data-testid="human-only-inbox">
            <div className="openspec-panel-head"><h2>Waiting on somebody</h2></div>
            <div className="openspec-panel-body">
            <p
              className={humanOnly.status === "failed" ? "openspec-overview-error" : "openspec-shell-note"}
              data-testid="human-only-inbox-basis"
            >
              {describeHumanOnlyInboxState(humanOnly)}
            </p>
            {humanOnly.status === "loaded" && humanOnly.inbox.items.length > 0 ? (
              <ul className="openspec-shell-note">
                {humanOnly.inbox.items.map((item) => {
                  const key = `${item.changeName}:${item.lineNumber}`;
                  // The control exists only where it can do something:
                  // an item waiting on a person is offered no run, and
                  // neither is one naming an id this build does not
                  // carry. See a-delegated-item-runs-its-agent.
                  const runnable = item.waitingOn.kind === "agent" && item.waitingOn.known;
                  const outcome = delegatedOutcomes[key];
                  return (
                    <li key={key} data-testid={`waiting-row-${key}`}>
                      <strong>{item.changeName}</strong>{` — ${item.text}`}
                      {` (waiting on ${describeWaitingOn(item.waitingOn)})`}
                      {runnable ? (
                        <>
                          {" "}
                          <button className="button"
                            type="button"
                            data-testid={`run-delegated-${key}`}
                            disabled={runningDelegated !== null}
                            onClick={() => void runDelegatedItem(item)}
                          >
                            {runningDelegated === key
                              ? "Running..."
                              : `Run ${item.waitingOn.kind === "agent" ? item.waitingOn.agent : ""}`}
                          </button>
                        </>
                      ) : null}
                      {item.reply ? <DelegatedReply reply={item.reply} testId={`delegated-reply-${key}`} /> : null}
                      {outcome ? (
                        <div data-testid={`delegated-outcome-${key}`}>
                          {outcome.message}
                          {outcome.lastStderr ? (
                            // The whole tail, one click away; the message
                            // already quotes its last line.
                            <details className="openspec-delegated-stderr" data-testid={`delegated-stderr-${key}`}>
                              <summary>What the agent last said</summary>
                              <pre>{outcome.lastStderr}</pre>
                            </details>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {humanOnly.status === "loaded" ? (
              <EnrolmentRequests
                requests={humanOnly.inbox.enrolments ?? []}
                confirming={confirmingEnrolment}
                outcomes={enrolmentOutcomes}
                onConfirm={(keyId) => void confirmEnrolment(keyId)}
              />
            ) : null}
            </div>
          </section>
        ) : null}
      </div>
      </BusyFieldset>
      </TabPanel>
      )}

      {visibleTabIds.has("change-editor") && (
      <TabPanel id="change-editor" activeTab={activeTab} lazy>
      <PanelStatus reading={shownReadings["change-editor"]} testId="tab-reading-change-editor" />
      <BusyFieldset busy={shownReadings["change-editor"] !== null}>
      {/* The shared components (the-remaining-tabs-wear-metro): one
          toolbar for the tab, the documents behind a segmented control,
          and the editor in a panel with its save in the foot. */}
      <div className="openspec-editor-screen">
        <section className="openspec-panel">
          <div className="openspec-panel-head">
            <h2>A new change</h2>
            <span className="openspec-panel-head-note">creates the directory and its documents</span>
          </div>
          <div className="openspec-panel-body">
        <div className="openspec-shell-grid">
          <label className="openspec-shell-field">
            New change id
            <input
              type="text"
              value={newChangeName}
              onChange={(e) => setNewChangeName(e.target.value)}
              placeholder="my-new-change"
            />
          </label>
          <label className="openspec-shell-field">
            Description
            <input
              type="text"
              value={newChangeDescription}
              onChange={(e) => setNewChangeDescription(e.target.value)}
              placeholder="Short change description"
            />
          </label>
        </div>
          </div>
          <div className="openspec-panel-foot">
            <button className="button primary" type="button" onClick={handleCreateChange} disabled={editorCreating || cwd.trim().length === 0}>
              {editorCreating ? "Creating..." : "Create change"}
            </button>
          </div>
        </section>

        <div className="openspec-controls" data-testid="change-editor-toolbar">

          <select
            aria-label="Change to edit"
            value={editorChangeName}
            onChange={(e) => {
              setEditorChangeName(e.target.value);
              setEditorRevision("");
            }}
            disabled={overview?.changes.length === 0}
          >
            <option value="">Select change</option>
            {(overview?.changes ?? []).map((change) => (
              <option key={change.name} value={change.name}>{change.name}</option>
            ))}
          </select>

          <button className="button"
            type="button"
            onClick={() => void loadChangeEditor(editorChangeName)}
            disabled={editorLoading || editorChangeName.trim().length === 0}
          >
            {editorLoading ? "Loading..." : "Load change"}
          </button>

          <button className="button primary"
            type="button"
            data-testid="run-with-harness-button"
            onClick={() => void handleRunWithHarness()}
            disabled={runHarnessLoading || cwd.trim().length === 0 || editorChangeName.trim().length === 0}
          >
            {runHarnessLoading ? "Resolving..." : "Run with Agentic Harness"}
          </button>
          {editorMessage ? <span className="openspec-shell-note">{editorMessage}</span> : null}
          {runHarnessMessage ? <span className="openspec-shell-note" data-testid="run-with-harness-message">{runHarnessMessage}</span> : null}
        </div>

        {runDispatch && runOpenedFrom === "editor" ? (
          <RunDialog
            changeName={runChangeName}
            plan={runDispatch.plan}
            {...(runStanding ? { standing: runStanding } : {})}
            stats={runStats}
            onChoose={startChosenRun}
            onApplyTemplate={(template) => void applyTemplateToChange(template)}
            appliedNote={runAppliedNote}
            onUseAgent={(agentId) => void putAgentOnEveryStage(agentId)}
            useAgentNote={runUseAgentNote}
            onSchedule={(path, startAt) => void scheduleRun(path, startAt)}
            {...(runNote ? { note: runNote } : {})}
            onDismiss={() => { setRunDispatch(null); setRunNote(null); setRunAppliedNote(null); setRunUseAgentNote(null); }}
          />
        ) : null}
        {chainChangeDir ? (
          <HarnessChainPanel transport={transport} cwd={cwd} changeDir={chainChangeDir} budget={chainBudget} />
        ) : null}

        <div className="openspec-controls">
          <div className="openspec-segmented" role="group" aria-label="Document to edit">
            {(["proposal", "design", "tasks", "spec"] as EditorTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={!harnessPaneOpen && tab === editorTab}
                onClick={() => { setEditorTab(tab); setHarnessPaneOpen(false); }}
              >
                {tab}
              </button>
            ))}
            <button
              type="button"
              data-testid="change-editor-tab-harness"
              aria-pressed={harnessPaneOpen}
              onClick={() => setHarnessPaneOpen(true)}
            >
              Harness
            </button>
          </div>
        </div>

        {harnessPaneOpen ? (
          // The loaded change, not the one merely selected: choosing another
          // change in the list clears the revision until it is loaded.
          editorRevision.length > 0 && editorChangeName.trim().length > 0 ? (
            <ChangeHarnessSettingsView
              api={harnessSettingsApi}
              changeName={editorChangeName}
              onEditGlobal={() => setActiveTab("harness-settings")}
            />
          ) : (
            <section className="openspec-panel">
              <div className="openspec-panel-head"><h2>Harness</h2></div>
              <p className="openspec-panel-body openspec-panel-empty" data-testid="change-editor-harness-empty">Load a change to configure it.</p>
            </section>
          )
        ) : (
        <>
        <section className="openspec-panel">
          {/* The change, with the document as its note: the textarea
              below already carries the label "Markdown (proposal)", and a
              head repeating it spends the line twice. */}
          <div className="openspec-panel-head">
            <h2>{editorChangeName.trim().length > 0 ? editorChangeName : "No change loaded"}</h2>
            <span className="openspec-panel-head-note">{editorTab}</span>
          </div>
        {editorTab === "tasks" ? (
          <div className="openspec-controls">
            <select
              aria-label="Copy tasks from archived change"
              value={archivedTemplateSource}
              onChange={(e) => setArchivedTemplateSource(e.target.value)}
              disabled={(overview?.archivedChanges.length ?? 0) === 0}
            >
              <option value="">Select archived change</option>
              {(overview?.archivedChanges ?? []).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button className="button"
              type="button"
              onClick={() => void handleInsertTasksTemplate()}
              disabled={
                archivedTemplateLoading ||
                archivedTemplateSource.trim().length === 0 ||
                editorChangeName.trim().length === 0
              }
            >
              {archivedTemplateLoading ? "Inserting..." : "Insert as template"}
            </button>
          </div>
        ) : null}
        {editorTab === "tasks" && archivedTemplateMessage ? (
          <p className="openspec-panel-fine">{archivedTemplateMessage}</p>
        ) : null}

        <div className="openspec-panel-body openspec-editor-grid">
          <label className="openspec-shell-field">
            Markdown ({editorTab})
            <textarea
              className="openspec-editor-textarea"
              value={editorFiles[editorTab]}
              onChange={(e) => {
                const value = e.target.value;
                // Which change has edits nobody has saved. A schedule
                // that came due must not load another change's files
                // over them — the save would then post these files
                // under that change's name, be refused by the hash
                // check, and the person would be told to reload, which
                // discards them. See a-schedule-keeps-its-promise.
                unsavedChange.current = editorChangeName;
                setEditorFiles((prev) => ({ ...prev, [editorTab]: value }));
              }}
              placeholder="Write markdown content"
            />
          </label>

          <div className="openspec-editor-preview">
            <h3>Preview</h3>
            <MarkdownPreview content={editorFiles[editorTab]} />
          </div>
        </div>

        <div className="openspec-panel-foot">
          <button className="button primary"
            type="button"
            onClick={handleSaveEditor}
            disabled={editorSaving || editorChangeName.trim().length === 0 || editorRevision.length === 0}
          >
            {editorSaving ? "Saving..." : "Save markdown"}
          </button>
        </div>
        </section>
        </>
        )}
      </div>
      </BusyFieldset>
      </TabPanel>
      )}

      {visibleTabIds.has("templates") && (
      <TabPanel id="templates" activeTab={activeTab} lazy>
      <PanelStatus reading={shownReadings["templates"]} testId="tab-reading-templates" />
      <BusyFieldset busy={shownReadings["templates"] !== null}>
      {/* The shared components (the-remaining-tabs-wear-metro): one
          toolbar, the catalog in a panel that says how many, and the
          chosen template in a panel of its own. */}
      <div className="openspec-templates-screen">
        <div className="openspec-controls">
          <button className="button primary" type="button" onClick={() => void handleLoadTemplates()} disabled={templatesLoading || cwd.trim().length === 0}>
            {templatesLoading ? "Loading..." : "Load templates"}
          </button>
          {templatesError ? <span className="openspec-overview-error">Failed to load templates: {templatesError}</span> : null}
          {templateActionMessage ? <span className="openspec-shell-note">{templateActionMessage}</span> : null}
        </div>

        <section className="openspec-panel">
          <div className="openspec-panel-head">
            <h2>Template catalog</h2>
            {templates ? (
              <span className="openspec-panel-head-note">
                {allTemplates.length === 1 ? "1 template" : `${allTemplates.length} templates`}
              </span>
            ) : null}
          </div>
          {templates ? (
            allTemplates.length === 0 ? (
              <p className="openspec-panel-body openspec-panel-empty">This workspace offers no templates.</p>
            ) : (
              /* The category is a column rather than a row spanning the
                 table, so the catalog is one table and not a list of
                 headings pretending to be rows. */
              <table className="table openspec-table" data-testid="templates-table">
                <thead>
                  <tr>
                    <th scope="col">Title</th>
                    <th scope="col">Category</th>
                    <th scope="col">Origin</th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {allTemplates.map((template) => (
                    <tr key={template.key} data-testid={`template-row-${template.key}`}>
                      <td>
                        {template.manifest.title}
                        {template.manifest.forkedFrom
                          ? <span className="badge openspec-template-badge openspec-template-badge--customized">customized</span>
                          : null}
                      </td>
                      <td>{template.manifest.category}</td>
                      <td>
                        <span className={`badge openspec-template-badge openspec-template-badge--${template.origin}`}>{template.origin}</span>
                      </td>
                      <td className="openspec-table-actions">
                        <button className="button" type="button" onClick={() => handleSelectTemplate(template)}>
                          Select
                        </button>
                        {template.origin === "built-in" && !isTemplateCustomized(template.manifest.id) ? (
                          <button className="button"
                            type="button"
                            onClick={() => void handleCustomizeTemplate(template.manifest.id)}
                            disabled={templateActionLoading}
                          >
                            Customize
                          </button>
                        ) : null}
                        {template.origin === "project" ? (
                          <button className="button alert"
                            type="button"
                            onClick={() => void handleDeleteProjectTemplate(template.manifest.id)}
                            disabled={templateActionLoading}
                          >
                            Delete
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <p className="openspec-panel-body openspec-panel-empty">Load the catalog to see the templates this workspace offers.</p>
          )}
        </section>

        {selectedTemplate ? (
          <section className="openspec-panel" data-testid="template-chosen">
            <div className="openspec-panel-head">
              <h2>{selectedTemplate.manifest.title}</h2>
              <span className="openspec-panel-head-note">{selectedTemplate.manifest.category}</span>
            </div>
            <div className="openspec-panel-body">
              <p className="openspec-shell-note">{selectedTemplate.manifest.summary}</p>
              {selectedTemplate.manifest.variables.map((variable) => (
                <label key={variable.name} className="openspec-shell-field">
                  {variable.prompt}
                  <input
                    type="text"
                    aria-label={variable.name}
                    value={templateVariableValues[variable.name] ?? ""}
                    onChange={(e) =>
                      setTemplateVariableValues((prev) => ({ ...prev, [variable.name]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="openspec-panel-foot">
              <label className="openspec-shell-field">
                Insert into change
                <select
                  aria-label="Insert template into change"
                  value={templateInsertTargetChange}
                  onChange={(e) => setTemplateInsertTargetChange(e.target.value)}
                  disabled={(overview?.changes.length ?? 0) === 0}
                >
                  <option value="">Select target change</option>
                  {(overview?.changes ?? []).map((change) => (
                    <option key={change.name} value={change.name}>{change.name}</option>
                  ))}
                </select>
              </label>
              <button className="button primary"
                type="button"
                onClick={() => void handleInsertTemplateIntoChange()}
                disabled={templateActionLoading || templateInsertTargetChange.trim().length === 0}
              >
                {templateActionLoading ? "Inserting..." : "Insert into change"}
              </button>
            </div>
          </section>
        ) : null}
      </div>
      </BusyFieldset>
      </TabPanel>
      )}

      {visibleTabIds.has("timeline") && (
      <TabPanel id="timeline" activeTab={activeTab} lazy>
      <PanelStatus reading={shownReadings["timeline"]} testId="tab-reading-timeline" />
      <BusyFieldset busy={shownReadings["timeline"] !== null}>
      <div className="openspec-timeline-screen">
        {/* The mockup's toolbar (the-change-timeline-looks-like-the-mockup):
            the modes as one segmented control, then, for one change, the
            picker that loads what it is given and the stale threshold. The
            comparison carries the same control in its own toolbar row, so
            the screen keeps one row of controls (the-timeline-compares-changes). */}
        {timelineMode === "multi" ? null : (
        <div className="openspec-controls openspec-timeline-toolbar" data-testid="timeline-toolbar">
          {timelineModes}
          {timelineMode === "single" ? (
            <Fragment>
              {/* Found by typing part of its name: a list of hundreds of
                  archived changes could not be searched by eye
                  (the-timeline-finds-a-change). */}
              <ChangePicker
                label="Change to show a timeline for"
                placeholder="Find a change by name"
                testId="timeline-change-picker"
                options={timelinePickerOptions}
                value={timelineSelection}
                onChange={(selection) => {
                  setTimelineSelection(selection);
                  // The change shown goes at once. Left up while the next one
                  // is read, it sat under a picker naming another change, with
                  // its own name in the page head (found by 6.6's live check).
                  timelineReading.current += 1;
                  setTimeline(null);
                  setTimelineMessage(null);
                  void loadTimeline(selection);
                }}
                disabled={timelinePickerOptions.length === 0}
              />
              {timelineMessage ? <span className="openspec-shell-note" data-testid="timeline-message">{timelineMessage}</span> : null}
              <label className="openspec-timeline-stale">
                Stale after
                <input
                  type="number"
                  aria-label="Stale task threshold in days"
                  min={1}
                  value={staleThresholdDays}
                  onChange={(e) => setStaleThresholdDays(Number(e.target.value) || DEFAULT_STALE_TASK_THRESHOLD_DAYS)}
                />
                days
              </label>
            </Fragment>
          ) : null}
        </div>
        )}

        {timelineMode === "single" ? (
          timeline ? <ChangeTimelineView timeline={timeline} staleThresholdDays={staleThresholdDays} /> : null
        ) : timelineMode === "multi" ? (
          /* Every change on a grid of days, read in one pass
             (the-timeline-compares-changes). Nothing is asked for first. */
          spans ? (
            <ChangeComparisonView
              leading={timelineModes}
              window={comparisonDays}
              rows={comparisonShown}
              total={comparisonAll.length}
              period={comparisonPeriod}
              onPeriod={setComparisonPeriod}
              filter={comparisonFilter}
              onFilter={setComparisonFilter}
              now={comparisonNow}
              onOpen={openTimelineOf}
              timelines={comparisonCharts}
              readingCharts={comparisonChartsReading > 0
                ? `Reading the history of ${comparisonChartsReading} ${comparisonChartsReading === 1 ? "change" : "changes"} from git…`
                : null}
              chartsError={comparisonChartsError}
            />
          ) : (
            <Fragment>
              <div className="openspec-controls openspec-timeline-toolbar" data-testid="timeline-toolbar">{timelineModes}</div>
              {spansMessage ? <p className="openspec-shell-note" data-testid="comparison-message">{spansMessage}</p> : null}
            </Fragment>
          )
        ) : (
      <section className="openspec-shell-panel">
        {(
          <Fragment>
            <div className="openspec-shell-grid">
              <label className="openspec-shell-field">
                Sprint start
                <input
                  type="date"
                  aria-label="Sprint report range start"
                  value={multiRangeStart}
                  onChange={(e) => setMultiRangeStart(e.target.value)}
                />
              </label>
              <label className="openspec-shell-field">
                Sprint end
                <input
                  type="date"
                  aria-label="Sprint report range end"
                  value={multiRangeEnd}
                  onChange={(e) => setMultiRangeEnd(e.target.value)}
                />
              </label>
            </div>
            <label className="openspec-shell-field">
              Changes in this sprint
              <select
                aria-label="Changes in this sprint"
                multiple
                value={multiSelection}
                onChange={(e) => setMultiSelection(Array.from(e.target.selectedOptions, (o) => o.value))}
                disabled={(overview?.changes.length ?? 0) + (overview?.archivedChanges.length ?? 0) === 0}
              >
                {(overview?.changes ?? []).map((change) => (
                  <option key={`active:${change.name}`} value={`active:${change.name}`}>{change.name}</option>
                ))}
                {(overview?.archivedChanges ?? []).map((name) => (
                  <option key={`archived:${name}`} value={`archived:${name}`}>{name} (archived)</option>
                ))}
              </select>
            </label>
            <div className="openspec-ai-panel-controls">
              <button className="button primary"
                type="button"
                onClick={() => void downloadSprintReport()}
                disabled={sprintReportLoading || multiSelection.length === 0}
              >
                {sprintReportLoading ? "Generating..." : "Download PDF"}
              </button>
            </div>

            {sprintReportMessage ? <p className="openspec-shell-note">{sprintReportMessage}</p> : null}
          </Fragment>
        )}
      </section>
        )}
      </div>
      </BusyFieldset>
      </TabPanel>
      )}

      {visibleTabIds.has("pipeline") && (
      <TabPanel id="pipeline" activeTab={activeTab} lazy>
      {/* No panel around it: the Pipeline is laid out in panels of its own
          (the-pipeline-cards-wear-metro). */}
      <div className="openspec-pipeline-tab">
        {cwd.trim().length > 0
          ? (
            <>
              <PipelineView
                load={pipelineLoad}
                survey={pipelineSurvey}
                lastRuns={pipelineLastRuns}
                standings={pipelineStandings}
                liveRuns={pipelineLiveRuns}
                refresh={pipelineRefresh}
                isActive={activeTab === "pipeline"}
                onOpenChange={openChangeInEditor}
                onRunControl={pipelineRunControl}
                onStart={pipelineStart}
                copyText={pipelineCopyText}
                viewState={pipelineViewState}
                onAskToStop={pipelineAskToStop}
                onArchive={pipelineArchive}
                onReadingChange={setPipelineReading}
              />
              {runOpenedFrom === "pipeline" && runHarnessMessage
                ? <p className="openspec-shell-note" data-testid="pipeline-run-message">{runHarnessMessage}</p>
                : null}
              {/* The run a card's Start opened, over the Pipeline where it
                  was pressed: its dialog, and then the chain it started
                  (a-change-is-run-from-its-card). */}
              {(runDispatch && runOpenedFrom === "pipeline") || pipelineChain ? (
                <div className="openspec-pipeline-run-layer" ref={pipelineRunLayer} data-testid="pipeline-run-layer">
                  {runDispatch && runOpenedFrom === "pipeline" ? (
                    <RunDialog
                      changeName={runChangeName}
                      plan={runDispatch.plan}
                      {...(runStanding ? { standing: runStanding } : {})}
                      stats={runStats}
                      onChoose={startChosenRun}
                      onApplyTemplate={(template) => void applyTemplateToChange(template)}
                      appliedNote={runAppliedNote}
                      onUseAgent={(agentId) => void putAgentOnEveryStage(agentId)}
                      useAgentNote={runUseAgentNote}
                      onSchedule={(path, startAt) => void scheduleRun(path, startAt)}
                      onDismiss={closePipelineRun}
                    />
                  ) : null}
                  {pipelineChain ? (
                    <section
                      className="openspec-shell-panel"
                      data-testid="pipeline-run-chain"
                      role="dialog"
                      aria-label={`Run ${runChangeName}`}
                      tabIndex={-1}
                    >
                      <h3>{`Run ${runChangeName}`}</h3>
                      <HarnessChainPanel transport={transport} cwd={cwd} changeDir={pipelineChain.changeDir} budget={pipelineChain.budget} />
                      <button className="button" type="button" data-testid="pipeline-run-close" onClick={closePipelineRun}>Close</button>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </>
          )
          : <p>Enter workspace root to see the pipeline.</p>}
      </div>
      </TabPanel>
      )}

      {visibleTabIds.has("harness-settings") && (
      <TabPanel id="harness-settings" activeTab={activeTab} lazy>
      <PanelStatus reading={shownReadings["harness-settings"]} testId="tab-reading-harness-settings" />
      <BusyFieldset busy={shownReadings["harness-settings"] !== null}>
      {/* Said where a person used to find a change's settings, since that
          is where they will look first (a-change-is-configured-from-the-
          change): in the page head's sentence where there is a page head,
          and here where there is none. */}
      {isStandaloneHost ? null : (
        <p className="openspec-shell-note" data-testid="harness-settings-change-pointer">
          A change's own settings are in the Change Editor, under Harness.
        </p>
      )}
      {cwd.trim().length > 0
        ? <GlobalHarnessSettingsView api={harnessSettingsApi} onReadingChange={setHarnessReading} showFile={harnessFileShown} />
        : <p className="openspec-shell-note">Enter workspace root to configure the harness.</p>}
      </BusyFieldset>
      </TabPanel>
      )}

      </div>

      {isStandaloneHost ? (
        <footer className="openspec-app-footer" data-testid="version-footer">
          <div className="openspec-app-footer-inner">
            <span>core {versions?.core ?? "…"} · server {versions?.server ?? "…"} · webui {__OPENSPEC_UI_WEBUI_VERSION__}</span>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("standalone-entry: #root element not found");
}
createRoot(container).render(<StandaloneApp />);
