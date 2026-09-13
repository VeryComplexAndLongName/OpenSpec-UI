// The Pipeline, in the editor — the-pipeline-opens-in-vs-code (ADR 0029).
//
// The same `PipelineView` the standalone shell draws, in a panel of its
// own. It reads over the request channel, against this host's workspace
// root and nothing a message names. The host watches the files each
// reading depends on and tells the view which reading is out of date, so
// the view does not list git worktrees on a timer while nothing changes.

import path from "node:path";
import * as vscode from "vscode";
import {
  createGitWrapper,
  discoverOpenSpecWorkspace,
  isValidChangeName,
  readPipelineReadiness,
  refreshSurveyRuns,
  resolveAgentStatusDirectory,
  surveyWorktrees,
  type WorktreeSurvey,
} from "@openspec-ui/core";
import { REQUEST_MESSAGE_TYPE, RESPONSE_MESSAGE_TYPE } from "./harness-requests.js";

export const PIPELINE_PANEL_TITLE = "OpenSpec UI: Pipeline";

/** Host to webview: a reading is out of date. */
export const PIPELINE_CHANGED_MESSAGE_TYPE = "openspec-ui/pipeline-changed";

/** Webview to host: a change's card was chosen. */
export const OPEN_CHANGE_MESSAGE_TYPE = "openspec-ui/open-change";

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
}

const DEFAULT_READERS: PipelineReaders = {
  readiness: (workspaceRoot) => readPipelineReadiness(workspaceRoot),
  survey: (workspaceRoot) => surveyWorktrees({ workspaceRoot, sweepStatuses: true }),
  refreshRuns: (survey) => refreshSurveyRuns(survey, { sweepStatuses: true }),
  statusDirectory: (workspaceRoot) => resolveAgentStatusDirectory(createGitWrapper({ cwd: workspaceRoot }), workspaceRoot),
  findActiveChange: async (workspaceRoot, changeName) =>
    (await discoverOpenSpecWorkspace(workspaceRoot)).changes.find((change) => change.name === changeName),
};

export interface PipelinePanelDeps {
  extensionUri: vscode.Uri;
  getWorkspaceRoot: () => string | undefined;
  /** Reveals an active change's row in the Changes tree, as
   * `openspec-ui.revealInChanges` does. */
  revealChange: (change: ActiveChange) => Promise<void>;
  readers?: Partial<PipelineReaders>;
  /** Test seam for the survey's age. */
  now?: () => number;
}

interface PipelineRequest {
  id: string;
  op: string;
}

function asRequest(data: unknown): PipelineRequest | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const message = data as Record<string, unknown>;
  if (message.type !== REQUEST_MESSAGE_TYPE || typeof message.id !== "string") return undefined;
  return { id: message.id, op: String(message.op) };
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
  private readonly testMessageListeners = new Set<(message: unknown) => void>();

  constructor(private readonly deps: PipelinePanelDeps) {
    this.readers = { ...DEFAULT_READERS, ...deps.readers };
    this.now = deps.now ?? (() => Date.now());
  }

  /** One panel per window, revealed when it is already open. */
  show(): void {
    if (this.panel) {
      this.panel.reveal();
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
    if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === OPEN_CHANGE_MESSAGE_TYPE) {
      await this.openChange((message as { changeName?: unknown }).changeName);
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
  private async openChange(changeName: unknown): Promise<void> {
    const workspaceRoot = this.deps.getWorkspaceRoot();
    if (!workspaceRoot) return;
    if (!isValidChangeName(changeName)) {
      void vscode.window.showInformationMessage(`OpenSpec UI: "${String(changeName)}" is not a change name this workspace can have.`);
      return;
    }
    const change = await this.readers.findActiveChange(workspaceRoot, changeName);
    if (!change) {
      void vscode.window.showInformationMessage(
        `OpenSpec UI: ${changeName} is not an active change of this workspace — it may have been archived or deleted since the Pipeline was read.`,
      );
      return;
    }
    await this.deps.revealChange(change);
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(change.path, "proposal.md")));
    await vscode.window.showTextDocument(document, { preview: false });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.deps.extensionUri, "dist", "pipeline.js"));
    const csp = `default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';`;
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
