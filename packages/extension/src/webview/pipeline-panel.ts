// The Pipeline, in the editor — the-pipeline-opens-in-vs-code (ADR 0029).
//
// The same `PipelineView` the standalone shell draws, in a panel of its
// own. It reads over the request channel, against this host's workspace
// root and nothing a message names. The host watches the files each
// reading depends on and tells the view which reading is out of date, so
// the view does not list git worktrees on a timer while nothing changes.

import path from "node:path";
import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import {
  archiveChange,
  askLiveRunToStop,
  createGitWrapper,
  describeStandingSources,
  myRosterLabel,
  discoverOpenSpecWorkspace,
  isValidChangeName,
  changeAction,
  isChangeActionId,
  say,
  withMessageCode,
  catchUpWithMain,
  readChangeStandings,
  readArchivedChanges,
  readBoardColumns,
  readChangeStagesOfWorkspace,
  summariseStage,
  readMainDrift,
  readLastRuns,
  readPipelineReadiness,
  refreshSurveyRuns,
  resolveAgentStatusDirectory,
  STANDING_FETCH_INTERVAL_MS,
  surveyWorktrees,
  type CatchUpResult,
  type ChangeStageReading,
  type ArchiveReading,  type BoardColumnsReading,
  type ChangeStandings,
  type MainDrift,
  type LastRunsReport,
  type LiveRuns,
  type WorktreeSurvey,
  isRunLogId,
  listRunLogs,
  readRunLog,
  commitTaskList,
  resolveOwnWorktree,
  resolveRunner,
  runOwnDelegatedItem,
  setTaskDone,
  type AgentRunner,
} from "@openspec-ui/core";
import { changeItemNamed } from "../change-action-target.js";
import { EMBED_THEME_PARAMETER, editorThemeName, frameFillingStyle } from "./embedded-page.js";
import { REQUEST_MESSAGE_TYPE, RESPONSE_MESSAGE_TYPE } from "./harness-requests.js";
import { ICON_FONT_SOURCE } from "./icon-font-source.js";

export const PIPELINE_PANEL_TITLE = "OpenSpec Workbench: Pipeline";

/** Host to webview: a reading is out of date. */
export const PIPELINE_CHANGED_MESSAGE_TYPE = "openspec-ui/pipeline-changed";

/** Webview to host: a change's card was chosen. */
export const OPEN_CHANGE_MESSAGE_TYPE = "openspec-ui/open-change";

/** Webview to host: a card's Start was pressed (a-change-is-run-from-its-card). */
export const RUN_CHANGE_MESSAGE_TYPE = "openspec-ui/run-change";

/** Webview to host: a card asked for its change's plan to be updated, after
 * a review that asked for changes (ADR 0041). */
export const UPDATE_PLAN_MESSAGE_TYPE = "openspec-ui/update-plan";
/** A card's answer to a run's question (the-agent-asks-the-operator). */
export const ANSWER_QUESTION_MESSAGE_TYPE = "openspec-ui/answer-question";

/** An answer a card gave, as the webview sends it. */
export interface CardQuestionAnswer {
  changeName: string;
  runId?: string;
  workingDirectory: string;
  questionId: string;
  answer: string;
}

function isCardQuestionAnswer(value: unknown): value is CardQuestionAnswer {
  if (typeof value !== "object" || value === null) return false;
  const answer = value as Record<string, unknown>;
  return isValidChangeName(answer.changeName)
    && (answer.runId === undefined || typeof answer.runId === "string")
    && typeof answer.workingDirectory === "string"
    && typeof answer.questionId === "string" && /^Q-[A-Za-z0-9-]+$/u.test(answer.questionId)
    && typeof answer.answer === "string" && answer.answer.trim().length > 0;
}

/** Webview to host: a card answered or stopped a run. */
export const RUN_CONTROL_MESSAGE_TYPE = "openspec-ui/run-control";

/** Webview to host: a card asked a run held elsewhere to stop
 * (a-run-elsewhere-can-be-asked-to-stop). */
export const ASK_TO_STOP_MESSAGE_TYPE = "openspec-ui/ask-to-stop";
/** The folded row's press (what-is-finished-is-tidied-away). */
export const ARCHIVE_CHANGES_MESSAGE_TYPE = "openspec-ui/archive-changes";

/** Webview to host: one of a change's actions was chosen on its card
 * (ADR 0044, a-change-is-acted-on-from-its-card). */
export const CHANGE_ACTION_MESSAGE_TYPE = "openspec-ui/change-action";

/** Host to webview: show this change's card - a change chosen in the
 * Workspace's navigator (the-side-panel-is-the-workspace). */
export const SHOW_CARD_MESSAGE_TYPE = "openspec-ui/show-card";

/** Webview to host: the page runs and can show a card. A page loads anew
 * each time the panel is shown, so a card asked for meanwhile waits for
 * this. */
export const PIPELINE_READY_MESSAGE_TYPE = "openspec-ui/pipeline-ready";

/** Host to webview: what became of a request to stop. */
export const ASK_TO_STOP_RESULT_MESSAGE_TYPE = "openspec-ui/ask-to-stop-result";

/** A request to stop from a message, or `undefined` for anything that is not
 * one: it needs an instance id and a reason, both non-blank. */
function asAskToStop(value: unknown): { instanceId: string; reason: string } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const message = value as Record<string, unknown>;
  if (typeof message.instanceId !== "string" || message.instanceId.trim().length === 0) return undefined;
  if (typeof message.reason !== "string" || message.reason.trim().length === 0) return undefined;
  return { instanceId: message.instanceId, reason: message.reason };
}

/** A control a card sends, as the host accepts it. */
export interface PipelineRunControl {
  changeName: string;
  runId: string;
  kind: "confirmCheckpoint" | "stop" | "cancel" | "resolvePermission";
  reason?: string;
  permissionRequestId?: string;
  permissionOutcome?: "allow" | "deny";
}

const RUN_CONTROL_KINDS: ReadonlySet<string> = new Set(["confirmCheckpoint", "stop", "cancel", "resolvePermission"]);

/** A control from a message, or `undefined` for anything that is not one. A
 * stop needs its reason, and a permission's answer its request and outcome. */
function asRunControl(value: unknown): PipelineRunControl | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const control = value as Record<string, unknown>;
  if (typeof control.changeName !== "string" || typeof control.runId !== "string" || typeof control.kind !== "string") return undefined;
  if (!RUN_CONTROL_KINDS.has(control.kind)) return undefined;
  const kind = control.kind as PipelineRunControl["kind"];
  if (kind === "stop" && (typeof control.reason !== "string" || control.reason.trim().length === 0)) return undefined;
  if (kind === "resolvePermission" && (typeof control.permissionRequestId !== "string"
    || (control.permissionOutcome !== "allow" && control.permissionOutcome !== "deny"))) return undefined;
  return {
    changeName: control.changeName,
    runId: control.runId,
    kind,
    ...(kind === "stop" ? { reason: String(control.reason) } : {}),
    ...(kind === "resolvePermission"
      ? { permissionRequestId: String(control.permissionRequestId), permissionOutcome: control.permissionOutcome as "allow" | "deny" }
      : {}),
  };
}

/** File events this close together become one message. A running change
 * rewrites its status record every few seconds and can write to its change
 * directory many times a second; the view needs to hear once. */
export const PIPELINE_EVENT_WINDOW_MS = 1_000;

/** How long a survey stands in for a new one when only status records have
 * changed. The view's own backstop re-reads on the same interval, so the
 * list of directories is never older than that. */
export const PIPELINE_SURVEY_REUSE_MS = 60_000;

export type PipelineReading = "readiness" | "survey";

export type ActiveChange = Awaited<ReturnType<typeof discoverOpenSpecWorkspace>>["changes"][number];

/** The readings, and the lookup opening a change needs. Real ones by
 * default; a test replaces the ones it counts. */
export interface PipelineReaders {
  readiness: (workspaceRoot: string) => Promise<unknown>;
  survey: (workspaceRoot: string) => Promise<WorktreeSurvey>;
  refreshRuns: (survey: WorktreeSurvey) => Promise<WorktreeSurvey>;
  statusDirectory: (workspaceRoot: string) => Promise<string>;
  findActiveChange: (workspaceRoot: string, changeName: string) => Promise<ActiveChange | undefined>;
  /** The change's own worktree, where it is worked (a-card-works-its-own-tasks). */
  ownWorktree: (workspaceRoot: string, changeName: string) => ReturnType<typeof resolveOwnWorktree>;
  /** The change a card names, as a Changes row carries it, so its action runs
   * the row's command where the change is worked (ADR 0044). */
  changeItem: (workspaceRoot: string, changeName: string) => ReturnType<typeof changeItemNamed>;
  /** Where every change stands, with the refs fetched now
   * (a-change-says-where-it-stands). */
  standingsNow: (workspaceRoot: string) => Promise<ChangeStandings>;
  /** How each change's last run ended (a-card-says-what-its-change-is-doing). */
  lastRuns: (workspaceRoot: string) => Promise<LastRunsReport>;
  /** Where every change stands, fetching refs only on the interval, so a
   * card's word is the Changes tree's (a-card-says-what-its-change-is-doing). */
  standings: (workspaceRoot: string) => Promise<ChangeStandings>;
  /** Where each change is on the board, and who holds it
   * (the-board-shows-the-stages). */
  stages: (workspaceRoot: string) => Promise<ChangeStageReading[]>;
  /** What this repository archived, as the server's default branch has
   * it (the-board-remembers-what-was-archived). */
  archived: (workspaceRoot: string) => Promise<ArchiveReading>;
  /** A team's own columns, from openspec/board.json (a-team-names-its-columns). */
  columns: (workspaceRoot: string) => Promise<BoardColumnsReading>;
  /** How far this checkout is behind what has landed, and what of it the
   * default branch already carries archived
   * (main-catches-up-with-what-landed). */
  drift: (workspaceRoot: string, standings: ChangeStandings | undefined) => Promise<MainDrift | undefined>;
  /** Brings the default branch up to its remote by fast-forward, or says
   * why it will not. */
  catchUp: (workspaceRoot: string) => Promise<CatchUpResult>;
  /** The roster label of this host's own key, beside a status directory. */
  myLabel: (statusDirectory: string) => Promise<string | undefined>;
  /** Asks a run the host reads as live to stop, with its own key
   * (a-run-elsewhere-can-be-asked-to-stop). */
  askLiveRun: typeof askLiveRunToStop;
}

const DEFAULT_READERS: PipelineReaders = {
  standingsNow: (workspaceRoot) => readChangeStandings(workspaceRoot, { fetch: "now" }),
  lastRuns: (workspaceRoot) => readLastRuns({ workspaceRoot }),
  standings: (workspaceRoot) => readChangeStandings(workspaceRoot, { fetch: { ifOlderThan: STANDING_FETCH_INTERVAL_MS } }),
  stages: (workspaceRoot) => readChangeStagesOfWorkspace(workspaceRoot),
  archived: (workspaceRoot) => readArchivedChanges(workspaceRoot, { git: createGitWrapper({ cwd: workspaceRoot }) }),
  columns: (workspaceRoot) => readBoardColumns(workspaceRoot),
  drift: async (workspaceRoot, standings) => readMainDrift({
    root: workspaceRoot,
    ...(standings !== undefined ? { standings } : {}),
  }),
  catchUp: (workspaceRoot) => catchUpWithMain({ root: workspaceRoot }),
  readiness: (workspaceRoot) => readPipelineReadiness(workspaceRoot),
  survey: (workspaceRoot) => surveyWorktrees({ workspaceRoot, sweepStatuses: true }),
  refreshRuns: (survey) => refreshSurveyRuns(survey, { sweepStatuses: true }),
  statusDirectory: (workspaceRoot) => resolveAgentStatusDirectory(createGitWrapper({ cwd: workspaceRoot }), workspaceRoot),
  findActiveChange: async (workspaceRoot, changeName) =>
    (await discoverOpenSpecWorkspace(workspaceRoot, { changes: "active", drafts: true })).changes.find((change) => change.name === changeName),
  myLabel: (statusDirectory) => myRosterLabel(statusDirectory),
  askLiveRun: (options) => askLiveRunToStop(options),
  ownWorktree: (workspaceRoot, changeName) => resolveOwnWorktree({ repositoryRoot: workspaceRoot, changeName }),
  changeItem: (workspaceRoot, changeName) => changeItemNamed(workspaceRoot, changeName),
};

export interface PipelinePanelDeps {
  extensionUri: vscode.Uri;
  getWorkspaceRoot: () => string | undefined;
  /** Reveals an active change's row in the Changes tree, as
   * `openspec-ui.showChange` does. */
  revealChange: (change: ActiveChange) => Promise<void>;
  /** The runs this extension host started and holds. A card offers its
   * controls only for these (a-change-is-run-from-its-card); without a
   * registry, it offers none. */
  liveRuns?: LiveRuns;
  /** Opens a change's run dialog, for a card's Start. */
  runChange?: (changeName: string) => Promise<void>;
  /** Opens the AI panel on `update` for a change, in its directory
   * (ADR 0041). */
  updatePlan?: (changeName: string, changeDir: string) => Promise<void>;
  /** Writes a card's answer to a run's question into its change's
   * decisions.md (ADR 0042). Absent, a card's answer is ignored. */
  answerQuestion?: (answer: CardQuestionAnswer) => Promise<void>;
  /** Draws the views again after the folded row archived what had landed
   * (what-is-finished-is-tidied-away). */
  refreshTrees?: () => void;
  /** Carries out a control for a run this host holds. */
  sendRunControl?: (control: PipelineRunControl) => void;
  readers?: Partial<PipelineReaders>;
  /** Test seam for the survey's age. */
  now?: () => number;
  /** If the optional local server is enabled and running — returns its base
   * URL (`http://127.0.0.1:<port>`); otherwise `undefined`. With a URL, the
   * panel embeds that server's own Pipeline tab instead of reading over the
   * message bridge (the-pipeline-answers-while-a-run-works). The panel never
   * starts the server itself. */
  getLocalServerUrl?: () => string | undefined;
  /** The runners for a change's own worktree, where a card runs a delegated
   * task (a-card-works-its-own-tasks). Without it, no task is run. */
  runnersFor?: (workspaceRoot: string) => Map<string, AgentRunner>;
}

/** What a card's name, or its menu, asks to open (a-card-works-its-own-tasks). */
export type OpenChangeTarget = "tasks" | "proposal" | "design" | "specs" | "window" | "copyPath";
const OPEN_CHANGE_TARGETS: ReadonlySet<string> = new Set(["tasks", "proposal", "design", "specs", "window", "copyPath"]);

interface PipelineRequest {
  id: string;
  op: string;
  /** What a request names, where it names something: a change, a run. */
  args?: unknown;
}

function asRequest(data: unknown): PipelineRequest | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const message = data as Record<string, unknown>;
  if (message.type !== REQUEST_MESSAGE_TYPE || typeof message.id !== "string") return undefined;
  return { id: message.id, op: String(message.op), ...(message.args !== undefined ? { args: message.args } : {}) };
}

export class PipelinePanel {
  private panel: vscode.WebviewPanel | undefined;
  private readonly readers: PipelineReaders;
  private readonly now: () => number;
  private watchers: vscode.Disposable[] = [];
  /** Bumped whenever watching stops, so a status directory resolved after
   * the panel was hidden does not start a watcher nobody disposes. */
  private watchGeneration = 0;
  private pending = new Set<PipelineReading>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private lastSurvey: { value: WorktreeSurvey; at: number } | undefined;
  private changesChangedSinceSurvey = false;
  private recordsChangedSinceSurvey = false;
  /** The local server's own origin, set only while the panel embeds it. An
   * `openspec-ui/open-change` message is honoured only when it carries this
   * same origin (the-pipeline-answers-while-a-run-works) — `undefined` in
   * bridge mode, where the message channel itself is the only origin there
   * is. */
  private embedOrigin: string | undefined;
  private readonly testMessageListeners = new Set<(message: unknown) => void>();
  /** The change whose card is to be shown, until a page can show it: a
   * panel being created, or loaded again after it was hidden, says when
   * its page runs (the-side-panel-is-the-workspace). */
  private pendingFocus: string | undefined;

  constructor(private readonly deps: PipelinePanelDeps) {
    this.readers = { ...DEFAULT_READERS, ...deps.readers };
    this.now = deps.now ?? (() => Date.now());
  }

  /** One panel per window, revealed when it is already open. With a
   * change, its card is shown: scrolled to and marked
   * (the-side-panel-is-the-workspace). */
  show(changeName?: string): void {
    this.pendingFocus = changeName !== undefined && isValidChangeName(changeName) ? changeName : undefined;
    if (this.panel) {
      // A panel not in sight has no page: shown, it loads one, which says
      // when it runs. One in sight is told now.
      const running = this.panel.visible;
      this.panel.reveal();
      if (running) this.showPendingCard(this.panel);
      return;
    }
    // Not retained while hidden: everything it shows can be read again,
    // and a hidden picture has nothing live to keep. Its watchers go with
    // it, and a panel shown again loads and reads afresh.
    const panel = vscode.window.createWebviewPanel(
      "openspecUiPipeline",
      PIPELINE_PANEL_TITLE,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.deps.extensionUri, "dist")],
      },
    );
    this.panel = panel;
    const localServerUrl = this.deps.getLocalServerUrl?.();
    if (localServerUrl) {
      // The server's own process takes the readings; this panel reads
      // nothing and starts no watchers of its own
      // (the-pipeline-answers-while-a-run-works). The outer document's own
      // relay script (in getLocalServerHtml) forwards
      // `openspec-ui/open-change` here with the embedded page's `origin`
      // attached; `handleMessage()` below accepts it only when that origin
      // is this one.
      this.embedOrigin = new URL(localServerUrl).origin;
      panel.webview.html = this.getLocalServerHtml(localServerUrl);
      const messages = panel.webview.onDidReceiveMessage((message: unknown) => void this.handleMessage(panel, message));
      // The framed page takes the editor's light or dark from its address, so
      // a theme switch loads it again in the new one. The cards are read
      // afresh; a run is not affected.
      const theme = vscode.window.onDidChangeActiveColorTheme(() => {
        panel.webview.html = this.getLocalServerHtml(localServerUrl);
      });
      panel.onDidDispose(() => {
        messages.dispose();
        theme.dispose();
        this.embedOrigin = undefined;
        this.panel = undefined;
      });
      return;
    }
    panel.webview.html = this.getHtml(panel.webview);
    const messages = panel.webview.onDidReceiveMessage((message: unknown) => void this.handleMessage(panel, message));
    const visibility = panel.onDidChangeViewState((event) => {
      if (event.webviewPanel.visible) this.startWatching(panel);
      else this.stopWatching();
    });
    panel.onDidDispose(() => {
      messages.dispose();
      visibility.dispose();
      this.stopWatching();
      this.lastSurvey = undefined;
      this.panel = undefined;
    });
    this.startWatching(panel);
  }

  private startWatching(panel: vscode.WebviewPanel): void {
    this.stopWatching();
    const workspaceRoot = this.deps.getWorkspaceRoot();
    if (!workspaceRoot) return;
    const generation = this.watchGeneration;

    const changes = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceRoot, "openspec/changes/**"));
    const onChanges = () => this.signal(panel, ["readiness", "survey"], "changes");
    this.watchers.push(changes, changes.onDidCreate(onChanges), changes.onDidChange(onChanges), changes.onDidDelete(onChanges));

    // The status directory lies outside the workspace, beside the
    // repository's working directories. Where it cannot be resolved, the
    // view's backstop is all there is, and the survey says why the records
    // could not be read.
    void this.readers.statusDirectory(workspaceRoot).then((directory) => {
      if (generation !== this.watchGeneration) return;
      const records = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(directory), "*.json"));
      const onRecords = () => this.signal(panel, ["survey"], "records");
      this.watchers.push(records, records.onDidCreate(onRecords), records.onDidChange(onRecords), records.onDidDelete(onRecords));
    }, () => undefined);
  }

  /** Tells the page to show the change's card, once. */
  private showPendingCard(panel: vscode.WebviewPanel): void {
    const changeName = this.pendingFocus;
    this.pendingFocus = undefined;
    if (changeName !== undefined) this.post(panel, { type: SHOW_CARD_MESSAGE_TYPE, changeName });
  }

  private post(panel: vscode.WebviewPanel, message: unknown): void {
    for (const listener of this.testMessageListeners) listener(message);
    void panel.webview.postMessage(message);
  }

  private stopWatching(): void {
    this.watchGeneration += 1;
    for (const watcher of this.watchers) watcher.dispose();
    this.watchers = [];
    if (this.flushTimer !== undefined) clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    this.pending.clear();
  }

  /** Collects what a file event makes out of date, and says it once for
   * every event within the window that the first one opened. */
  private signal(panel: vscode.WebviewPanel, readings: PipelineReading[], source: "changes" | "records"): void {
    // An event a disposed watcher still delivers on its way out is for a
    // picture nobody is looking at.
    if (this.watchers.length === 0) return;
    for (const reading of readings) this.pending.add(reading);
    if (source === "changes") this.changesChangedSinceSurvey = true;
    else this.recordsChangedSinceSurvey = true;
    if (this.flushTimer !== undefined) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      const message = { type: PIPELINE_CHANGED_MESSAGE_TYPE, readings: [...this.pending] };
      this.pending.clear();
      for (const listener of this.testMessageListeners) listener(message);
      void panel.webview.postMessage(message);
    }, PIPELINE_EVENT_WINDOW_MS);
  }

  private async handleMessage(panel: vscode.WebviewPanel, message: unknown): Promise<void> {
    if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === PIPELINE_READY_MESSAGE_TYPE) {
      this.showPendingCard(panel);
      return;
    }
    if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === OPEN_CHANGE_MESSAGE_TYPE) {
      const { changeName, origin, target, line } = message as { changeName?: unknown; origin?: unknown; target?: unknown; line?: unknown };
      // In embed mode, only a message carrying this embed's own origin is
      // honoured — one from any other origin is ignored, whatever change
      // name it names (the-pipeline-answers-while-a-run-works).
      if (this.embedOrigin !== undefined && origin !== this.embedOrigin) return;
      await this.openChange(
        changeName,
        typeof target === "string" && OPEN_CHANGE_TARGETS.has(target) ? target as OpenChangeTarget : "tasks",
        typeof line === "number" && Number.isInteger(line) && line >= 0 ? line : undefined,
      );
      return;
    }
    if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === RUN_CHANGE_MESSAGE_TYPE) {
      await this.runChange((message as { changeName?: unknown }).changeName);
      return;
    }
    if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === ANSWER_QUESTION_MESSAGE_TYPE) {
      const answer = (message as { answer?: unknown }).answer;
      if (isCardQuestionAnswer(answer)) await this.deps.answerQuestion?.(answer);
      return;
    }
    if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === UPDATE_PLAN_MESSAGE_TYPE) {
      await this.updatePlan((message as { changeName?: unknown }).changeName);
      return;
    }
    if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === RUN_CONTROL_MESSAGE_TYPE) {
      this.runControl((message as { control?: unknown }).control);
      return;
    }
    if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === ASK_TO_STOP_MESSAGE_TYPE) {
      await this.askToStop(panel, message);
      return;
    }
    if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === ARCHIVE_CHANGES_MESSAGE_TYPE) {
      await this.archiveChanges((message as { changeNames?: unknown }).changeNames);
      return;
    }
    if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === CHANGE_ACTION_MESSAGE_TYPE) {
      const { action, changeName, confirmed, origin } = message as { action?: unknown; changeName?: unknown; confirmed?: unknown; origin?: unknown };
      // The same rule as opening a change: in embed mode, only the embed's
      // own origin is honoured.
      if (this.embedOrigin !== undefined && origin !== this.embedOrigin) return;
      await this.performChangeAction(action, changeName, confirmed === true);
      return;
    }
    const request = asRequest(message);
    if (!request) return;
    const reply = (body: { ok: boolean; value?: unknown; error?: string }) => {
      const response = { type: RESPONSE_MESSAGE_TYPE, id: request.id, ...body };
      for (const listener of this.testMessageListeners) listener(response);
      void panel.webview.postMessage(response);
    };
    const workspaceRoot = this.deps.getWorkspaceRoot();
    if (!workspaceRoot) {
      reply({ ok: false, error: "no workspace root is open" });
      return;
    }
    try {
      switch (request.op) {
        case "pipeline/readiness":
          reply({ ok: true, value: await this.readers.readiness(workspaceRoot) });
          return;
        case "pipeline/survey":
          reply({ ok: true, value: await this.surveyFor(workspaceRoot) });
          return;
        case "pipeline/last-runs":
          reply({ ok: true, value: await this.readers.lastRuns(workspaceRoot) });
          return;
        case "pipeline/standings":
          reply({ ok: true, value: await this.readers.standings(workspaceRoot) });
          return;
        case "pipeline/board-columns":
          reply({ ok: true, value: await this.readers.columns(workspaceRoot) });
          return;
        case "pipeline/archived":
          reply({ ok: true, value: await this.readers.archived(workspaceRoot) });
          return;
        case "pipeline/stages":
          reply({ ok: true, value: (await this.readers.stages(workspaceRoot)).map((reading) => summariseStage(reading)) });
          return;
        case "pipeline/drift": {
          // The standings are read for the one thing the drift needs from
          // them, and a reading that fails leaves the counts standing:
          // being behind is worth saying without `gh`
          // (main-catches-up-with-what-landed).
          let standings: ChangeStandings | undefined;
          try {
            standings = await this.readers.standings(workspaceRoot);
          } catch {
            standings = undefined;
          }
          reply({ ok: true, value: (await this.readers.drift(workspaceRoot, standings)) ?? null });
          return;
        }
        case "pipeline/catch-up":
          reply({ ok: true, value: await this.readers.catchUp(workspaceRoot) });
          return;
        case "pipeline/live-runs": {
          // The same shape the server's /api/live-runs answers, for this
          // host's own root and nothing a message names.
          const root = path.resolve(workspaceRoot);
          const runs = (this.deps.liveRuns?.list() ?? []).filter((run) => path.resolve(run.cwd) === root);
          // The label this host's key is enrolled under, so a card offers
          // Stop on a run elsewhere only when it is this person's
          // (a-run-elsewhere-can-be-asked-to-stop).
          const statusDirectory = await this.readers.statusDirectory(workspaceRoot).catch(() => undefined);
          const myLabel = statusDirectory === undefined ? undefined : await this.readers.myLabel(statusDirectory);
          reply({ ok: true, value: { runs, ...(myLabel !== undefined ? { myLabel } : {}) } });
          return;
        }
        case "pipeline/run-logs": {
          // For this host's own root, and the one change the card names.
          const changeName = (request.args as { changeName?: unknown } | undefined)?.changeName;
          if (typeof changeName !== "string" || changeName.length === 0) {
            reply({ ok: false, error: "a change name is required" });
            return;
          }
          reply({ ok: true, value: await listRunLogs(workspaceRoot, { changeName }) });
          return;
        }
        case "pipeline/run-log": {
          const runId = (request.args as { runId?: unknown } | undefined)?.runId;
          if (typeof runId !== "string" || !isRunLogId(runId)) {
            reply({ ok: false, error: "a run id is required" });
            return;
          }
          const records = await readRunLog(workspaceRoot, runId);
          if (records === undefined) {
            reply({ ok: false, error: `no log is kept for run ${runId}` });
            return;
          }
          reply({ ok: true, value: records });
          return;
        }
        // A card's task controls (a-card-works-its-own-tasks). Each names a
        // change and a line; core resolves the change's own worktree from
        // this host's root, so nothing a message names is written to.
        case "pipeline/task-set": {
          const args = request.args as { changeName?: unknown; lineNumber?: unknown; expectedText?: unknown; done?: unknown; note?: unknown } | undefined;
          if (!isValidChangeName(args?.changeName) || typeof args?.lineNumber !== "number" || typeof args.expectedText !== "string"
            || typeof args.done !== "boolean" || (args.note !== undefined && typeof args.note !== "string")) {
            reply({ ok: false, error: "a change name, a line, its text and done are required" });
            return;
          }
          reply({
            ok: true,
            value: await setTaskDone({
              repositoryRoot: workspaceRoot,
              changeName: args.changeName,
              lineNumber: args.lineNumber,
              expectedText: args.expectedText,
              done: args.done,
              ...(typeof args.note === "string" ? { note: args.note } : {}),
            }),
          });
          return;
        }
        case "pipeline/task-commit": {
          const changeName = (request.args as { changeName?: unknown } | undefined)?.changeName;
          if (!isValidChangeName(changeName)) {
            reply({ ok: false, error: "a change name is required" });
            return;
          }
          reply({ ok: true, value: await commitTaskList({ repositoryRoot: workspaceRoot, changeName }) });
          return;
        }
        case "pipeline/task-run": {
          const args = request.args as { changeName?: unknown; lineNumber?: unknown } | undefined;
          const runnersFor = this.deps.runnersFor;
          if (!isValidChangeName(args?.changeName) || typeof args?.lineNumber !== "number" || runnersFor === undefined) {
            reply({ ok: false, error: "a change name and a line are required, and this host must run agents" });
            return;
          }
          reply({
            ok: true,
            value: await runOwnDelegatedItem({
              repositoryRoot: workspaceRoot,
              changeName: args.changeName,
              lineNumber: args.lineNumber,
              runnersFor: (root) => {
                const runners = runnersFor(root);
                return (agentId) => {
                  const runner = resolveRunner(runners, agentId);
                  return runner !== undefined && this.deps.liveRuns !== undefined ? this.deps.liveRuns.runner(runner) : runner;
                };
              },
            }),
          });
          return;
        }
        case "pipeline/refresh": {
          // Fetches now, whatever the interval, and forgets the survey held,
          // so the readings the view asks for next are taken afresh.
          const standings = await this.readers.standingsNow(workspaceRoot);
          this.lastSurvey = undefined;
          reply({ ok: true, value: describeStandingSources(standings.sources) });
          return;
        }
        default:
          // Refused by name: a request that vanishes is a promise that
          // never settles.
          reply({ ok: false, error: `unknown operation "${request.op}"` });
      }
    } catch (error) {
      reply({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** A full survey, unless only status records have changed since the
   * last one and it is recent: then its runs are read again without git. A
   * heartbeat every five seconds per run would otherwise be a `git
   * worktree list` every few seconds while anything runs. */
  private async surveyFor(workspaceRoot: string): Promise<WorktreeSurvey> {
    const last = this.lastSurvey;
    const now = this.now();
    if (
      last !== undefined
      && this.recordsChangedSinceSurvey
      && !this.changesChangedSinceSurvey
      && now - last.at < PIPELINE_SURVEY_REUSE_MS
    ) {
      this.recordsChangedSinceSurvey = false;
      const refreshed = await this.readers.refreshRuns(last.value);
      this.lastSurvey = { value: refreshed, at: last.at };
      return refreshed;
    }
    this.changesChangedSinceSurvey = false;
    this.recordsChangedSinceSurvey = false;
    const value = await this.readers.survey(workspaceRoot);
    this.lastSurvey = { value, at: now };
    return value;
  }

  /** Opens a change the view named, after checking the name is one this
   * workspace can have and is one of its active changes. A message never
   * says what gets opened: the path comes from this host's own lookup. */
  /** A card's Start: checked as opening a change is, then the change's run
   * dialog (a-change-is-run-from-its-card). */
  private async runChange(changeName: unknown): Promise<void> {
    const workspaceRoot = this.deps.getWorkspaceRoot();
    if (!workspaceRoot || this.deps.runChange === undefined) return;
    if (!isValidChangeName(changeName)) {
      void vscode.window.showInformationMessage(`OpenSpec Workbench: "${String(changeName)}" is not a change name this workspace can have.`);
      return;
    }
    const change = await this.readers.findActiveChange(workspaceRoot, changeName);
    if (!change) {
      void vscode.window.showInformationMessage(
        `OpenSpec Workbench: ${changeName} is not an active change of this workspace — it may have been archived or deleted since the Pipeline was read.`,
      );
      return;
    }
    await this.deps.runChange(changeName);
  }

  /** A card's Update the plan, for an active change of this workspace only
   * (ADR 0041). */
  private async updatePlan(changeName: unknown): Promise<void> {
    const workspaceRoot = this.deps.getWorkspaceRoot();
    if (!workspaceRoot || this.deps.updatePlan === undefined) return;
    if (!isValidChangeName(changeName)) return;
    const change = await this.readers.findActiveChange(workspaceRoot, changeName);
    if (!change) {
      void vscode.window.showInformationMessage(
        `OpenSpec Workbench: ${changeName} is not an active change of this workspace — it may have been archived or deleted since the Pipeline was read.`,
      );
      return;
    }
    await this.deps.updatePlan(changeName, change.path);
  }

  /** A card's answer or stop, carried out only for a run this host holds,
   * in its own workspace, on the change the card names. A message naming
   * anything else changes nothing. */
  private runControl(message: unknown): void {
    const workspaceRoot = this.deps.getWorkspaceRoot();
    const control = asRunControl(message);
    if (!workspaceRoot || control === undefined || this.deps.sendRunControl === undefined) return;
    const held = this.deps.liveRuns?.get(control.runId);
    if (held === undefined || held.changeName !== control.changeName) return;
    if (path.resolve(held.cwd) !== path.resolve(workspaceRoot)) return;
    this.deps.sendRunControl(control);
  }

  /** A card's Stop on a run held elsewhere (a-run-elsewhere-can-be-asked-to-stop).
   * The request is written only for a run this host reads as live in its own
   * workspace's status directory, with this host's key; any other instance is
   * refused. What became of it goes back to the view, and a message that is
   * not a request changes nothing. */
  /** Archives the changes the folded row named, one after another, and
   * says what could not be archived rather than stopping at the first
   * (what-is-finished-is-tidied-away). Nothing is archived without that
   * press: this is only reached by one. */
  private async archiveChanges(changeNames: unknown): Promise<void> {
    const workspaceRoot = this.deps.getWorkspaceRoot();
    if (!workspaceRoot) return;
    const names = Array.isArray(changeNames)
      ? changeNames.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
      : [];
    if (names.length === 0) return;
    const archived: string[] = [];
    const failures: string[] = [];
    for (const changeName of names) {
      try {
        const result = await archiveChange(changeName, { cwd: workspaceRoot }) as Record<string, unknown>;
        if (result.ok === false) failures.push(`${changeName}: ${typeof result.report === "string" ? result.report : "refused"}`);
        else archived.push(changeName);
      } catch (error) {
        failures.push(`${changeName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    this.deps.refreshTrees?.();
    if (failures.length === 0) {
      void vscode.window.showInformationMessage(
        `OpenSpec Workbench: archived ${archived.length === 1 ? archived[0] : `${archived.length} changes`}.`,
      );
    } else {
      void vscode.window.showWarningMessage(
        `OpenSpec Workbench: archived ${archived.length} of ${names.length}. ${failures.join("; ")}`,
      );
    }
  }

  private async askToStop(panel: vscode.WebviewPanel, message: unknown): Promise<void> {
    const request = asAskToStop(message);
    const workspaceRoot = this.deps.getWorkspaceRoot();
    if (request === undefined || !workspaceRoot) return;
    const statusDirectory = await this.readers.statusDirectory(workspaceRoot).catch(() => undefined);
    const result = statusDirectory === undefined
      ? { asked: false as const, why: `no live run reports itself as ${request.instanceId}: this workspace has no status records to read` }
      : await this.readers.askLiveRun({ statusDirectory, workspaceRoot, instanceId: request.instanceId, reason: request.reason })
        .catch((error: unknown) => ({ asked: false as const, why: error instanceof Error ? error.message : String(error) }));
    const response = { type: ASK_TO_STOP_RESULT_MESSAGE_TYPE, instanceId: request.instanceId, ...result };
    for (const listener of this.testMessageListeners) listener(response);
    void panel.webview.postMessage(response);
  }

  /** Runs the command a card's action names, on the change as the Changes
   * tree would carry it, so a card does what a row does, where the change is
   * worked (ADR 0044). The action and the name are checked against this
   * host's own list and workspace, never trusted from the message. */
  private async performChangeAction(action: unknown, changeName: unknown, confirmed: boolean): Promise<void> {
    const workspaceRoot = this.deps.getWorkspaceRoot();
    if (!workspaceRoot || !isChangeActionId(action)) return;
    if (!isValidChangeName(changeName)) {
      const refused = say("OSW-CHG-001", { name: String(changeName) });
      void vscode.window.showWarningMessage(withMessageCode(refused.text, refused.code));
      return;
    }
    const item = await this.readers.changeItem(workspaceRoot, changeName);
    if (item === undefined) {
      const gone = say("OSW-CHG-002", { name: changeName });
      void vscode.window.showInformationMessage(withMessageCode(gone.text, gone.code));
      return;
    }
    const command = changeAction(action)?.command;
    if (command === undefined) return;
    // Start is the card's own control, and names its change as it always has.
    await vscode.commands.executeCommand(command, action === "runChange" ? changeName : item, { confirmed });
  }

  /** Opens what a card asks for, from where the change is worked: its own
   * worktree where it has one, otherwise this checkout's copy
   * (a-card-works-its-own-tasks). A change worked in its own worktree
   * usually is not in this checkout at all until its pull request merges,
   * which is why looking here alone opened nothing. The paths come from
   * this host's own lookup, never from the message. */
  private async openChange(changeName: unknown, target: OpenChangeTarget = "tasks", line?: number): Promise<void> {
    const workspaceRoot = this.deps.getWorkspaceRoot();
    if (!workspaceRoot) return;
    if (!isValidChangeName(changeName)) {
      void vscode.window.showInformationMessage(`OpenSpec Workbench: "${String(changeName)}" is not a change name this workspace can have.`);
      return;
    }
    let root: string;
    let changeDir: string;
    const own = await this.readers.ownWorktree(workspaceRoot, changeName).catch(() => undefined);
    if (own?.ok === true) {
      root = own.path;
      changeDir = path.dirname(own.tasksPath);
    } else {
      const change = await this.readers.findActiveChange(workspaceRoot, changeName);
      if (!change) {
        void vscode.window.showInformationMessage(
          `OpenSpec Workbench: ${changeName} is neither in a worktree of its own nor an active change of this checkout — it may have been archived or deleted since the Pipeline was read.`,
        );
        return;
      }
      await this.deps.revealChange(change);
      root = workspaceRoot;
      changeDir = change.path;
    }

    if (target === "window") {
      await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(root), { forceNewWindow: true });
      return;
    }
    if (target === "copyPath") {
      await vscode.env.clipboard.writeText(root);
      void vscode.window.showInformationMessage(`OpenSpec Workbench: copied ${root}`);
      return;
    }
    if (target === "specs") {
      // The folder in the system's file manager: a worktree is outside this
      // window's folder, so the Explorer cannot show it.
      await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(path.join(changeDir, "specs")));
      return;
    }
    const file = path.join(changeDir, `${target}.md`);
    let document: vscode.TextDocument;
    try {
      document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
    } catch {
      void vscode.window.showInformationMessage(`OpenSpec Workbench: ${changeName} has no ${target}.md in ${root}.`);
      return;
    }
    const at = line !== undefined ? new vscode.Position(Math.min(line, Math.max(document.lineCount - 1, 0)), 0) : undefined;
    await vscode.window.showTextDocument(document, {
      preview: false,
      ...(at !== undefined ? { selection: new vscode.Range(at, at) } : {}),
    });
  }

  /** Embeds the local server's own Pipeline tab, the way `AiPanel`'s
   * optional-local-server mode embeds its Run a Command tab. CSP is scoped
   * to that exact localhost address. Built via `URL`, not string
   * concatenation, so `tab=pipeline` lands correctly ahead of the
   * `#token=...` fragment already present in `baseUrl`.
   *
   * The outer document also carries a small relay script: the embedded
   * page posts `openspec-ui/open-change` to `window.parent`
   * (a-change-opened-from-the-editor's-pipeline), and this script is what
   * receives that `message` event, checks its `origin` against the local
   * server's own origin, and only then hands it to the extension host via
   * `acquireVsCodeApi().postMessage()` — the same channel `handleMessage()`
   * already answers `openspec-ui/open-change` on in bridge mode. A message
   * from any other origin is dropped here and never reaches the host. */
  private getLocalServerHtml(baseUrl: string): string {
    const iframeUrl = new URL(baseUrl);
    iframeUrl.searchParams.set("embed", "vscode-local-server");
    iframeUrl.searchParams.set("tab", "pipeline");
    iframeUrl.searchParams.set(EMBED_THEME_PARAMETER, editorThemeName());
    const iframeSrc = iframeUrl.toString();
    const serverOrigin = iframeUrl.origin;
    // A nonce, not a blanket 'unsafe-inline', authorizes only this one
    // inline script and this one stylesheet — see timeline-panel.ts for the
    // same pattern, and embedded-page.ts for why the style needs it.
    const nonce = randomBytes(16).toString("base64");
    const fill = frameFillingStyle(nonce);
    const csp = `default-src 'none'; frame-src ${baseUrl}; script-src 'nonce-${nonce}'; ${fill.directive}`;
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>${PIPELINE_PANEL_TITLE}</title>
    ${fill.element}
  </head>
  <body>
    <iframe src="${iframeSrc}"></iframe>
    <script nonce="${nonce}">
      const vscodeApi = acquireVsCodeApi();
      const frame = document.querySelector("iframe");
      // The page runs: a card asked for while it loaded can be shown.
      frame.addEventListener("load", () => vscodeApi.postMessage({ type: ${JSON.stringify(PIPELINE_READY_MESSAGE_TYPE)} }));
      window.addEventListener("message", (event) => {
        // The host's own message to show a card goes on to the page, and
        // to its origin alone (the-side-panel-is-the-workspace).
        if (event.origin !== ${JSON.stringify(serverOrigin)}) {
          if (event.data && event.data.type === ${JSON.stringify(SHOW_CARD_MESSAGE_TYPE)} && typeof event.data.changeName === "string" && frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: event.data.type, changeName: event.data.changeName }, ${JSON.stringify(serverOrigin)});
          }
          return;
        }
        if (!event.data || (event.data.type !== ${JSON.stringify(OPEN_CHANGE_MESSAGE_TYPE)} && event.data.type !== ${JSON.stringify(CHANGE_ACTION_MESSAGE_TYPE)})) return;
        vscodeApi.postMessage({ ...event.data, origin: event.origin });
      });
    </script>
  </body>
</html>`;
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.deps.extensionUri, "dist", "pipeline.js"));
    const csp = `default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; ${ICON_FONT_SOURCE}`;
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>${PIPELINE_PANEL_TITLE}</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="${scriptUri.toString()}"></script>
  </body>
</html>`;
  }

  /** Test-only in intent: delivers a message through the same handler a
   * real webview message reaches. No-op when the panel is not open. */
  async deliverMessageForTesting(message: unknown): Promise<void> {
    if (!this.panel) return;
    await this.handleMessage(this.panel, message);
  }

  /** Observes every message the host posts to the webview. */
  onMessageForTesting(listener: (message: unknown) => void): vscode.Disposable {
    this.testMessageListeners.add(listener);
    return { dispose: () => this.testMessageListeners.delete(listener) };
  }

  getTitleForTesting(): string | undefined {
    return this.panel?.title;
  }

  isOpenForTesting(): boolean {
    return this.panel !== undefined;
  }
}
