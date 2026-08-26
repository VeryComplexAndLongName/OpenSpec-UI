// Entry point for the standalone browser shell (see
// openspec/changes/standalone-app/tasks.md 2.1). Not part of the package's
// public API (not re-exported from index.ts) — this is bootstrap code
// specifically for `packages/server`'s build (see scripts/build-client.mjs),
// not library code reused in the extension.

import { createRoot } from "react-dom/client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { FetchTransport } from "./transport/fetch-transport.js";
import { AiPanel } from "./components/AiPanel.js";
import { describeRunCompletionNotification } from "./notify-run-completion.js";
import { ChangeDiff } from "./components/ChangeDiff.js";
import { ChangeTimelineView } from "./components/ChangeTimelineView.js";
import { ProcessesView, type ProcessesApi } from "./components/ProcessesView.js";
import { Tabs, TabPanel } from "./components/Tabs.js";
import { buildDefaultChangeDir, shellThemeCss } from "./shell-ui.js";
import { VSCODE_LOCAL_SERVER_EMBED_SIGNAL, computeVisibleTabs, readEmbedSignal } from "./host-embed.js";
import { renderMarkdown } from "./markdown.js";
import {
  ChangeEditorSaveConflictError,
  loadArchivedTasksTemplate,
  loadChangeEditorDocument,
  mergeTasksTemplate,
  saveChangeEditorDocument,
  type ChangeEditorFiles,
} from "./change-editor-client.js";
import { loadChangeTimeline, type ChangeTimeline } from "./change-timeline-client.js";
import {
  customizeTemplate as customizeTemplateApi,
  deleteProjectTemplate as deleteProjectTemplateApi,
  listTemplates as listTemplatesApi,
  renderTemplate as renderTemplateApi,
} from "./template-catalog-client.js";
import { detectAgents as detectAgentsApi } from "./agent-detection-client.js";
import type { CatalogTemplate, CommandKind, Event } from "@openspec-ui/core/browser";

interface OverviewChange {
  name: string;
  status: string;
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
  const [activeTab, setActiveTab] = useState<string>("run-a-command");
  const [cwd, setCwd] = useState(() => readStoredValue(STORAGE_KEYS.cwd));
  const [changeDir, setChangeDir] = useState(() => readStoredValue(STORAGE_KEYS.changeDir));
  const [overview, setOverview] = useState<OpenSpecOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [editorChangeName, setEditorChangeName] = useState("");
  const [editorFiles, setEditorFiles] = useState<ChangeEditorFiles>(EMPTY_EDITOR_FILES);
  const [editorRevision, setEditorRevision] = useState("");
  const [editorTab, setEditorTab] = useState<EditorTab>("proposal");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorCreating, setEditorCreating] = useState(false);
  const [newChangeName, setNewChangeName] = useState("");
  const [newChangeDescription, setNewChangeDescription] = useState("");
  const [editorMessage, setEditorMessage] = useState<string | null>(null);
  const [timelineSelection, setTimelineSelection] = useState("");
  const [timeline, setTimeline] = useState<ChangeTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineMessage, setTimelineMessage] = useState<string | null>(null);
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
  const [versions, setVersions] = useState<WorkbenchVersions | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const workspaceRoot = await loadWorkspaceRoot();
        if (cancelled) return;
        setCwd(workspaceRoot);
        setChangeDir(buildDefaultChangeDir(workspaceRoot));
        setWorkspaceRootSyncError(null);
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

  function handleCwdChange(nextCwd: string) {
    setCwd(nextCwd);
    setChangeDir(buildDefaultChangeDir(nextCwd));
  }

  async function handleLoadOverview() {
    if (cwd.trim().length === 0) {
      setOverviewError("Enter a workspace root before loading overview.");
      return;
    }

    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const response = await apiFetch("/api/overview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        const message = payload.error ?? `${response.status} ${response.statusText}`;
        throw new Error(message);
      }

      const payload = (await response.json()) as OpenSpecOverview;
      setOverview(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOverviewError(message);
      setOverview(null);
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
      setEditorMessage(`Loaded ${changeName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEditorMessage(`Load failed: ${message}`);
    } finally {
      setEditorLoading(false);
    }
  }

  async function loadTimeline() {
    if (cwd.trim().length === 0) {
      setTimelineMessage("Enter workspace root first.");
      return;
    }
    const [prefix, ...rest] = timelineSelection.split(":");
    const changeName = rest.join(":");
    if (!changeName || (prefix !== "active" && prefix !== "archived")) {
      setTimelineMessage("Select a change first.");
      return;
    }
    setTimelineLoading(true);
    setTimelineMessage(null);
    try {
      const loaded = await loadChangeTimeline(apiFetch, cwd, changeName, prefix === "archived");
      setTimeline(loaded);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTimelineMessage(`Load failed: ${message}`);
      setTimeline(null);
    } finally {
      setTimelineLoading(false);
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

  return (
    <div className="openspec-standalone-app">
      <style>{shellThemeCss}</style>

      <header className="openspec-shell-headline">
        <h1>OpenSpec UI</h1>
        <p>Standalone command console for OpenSpec changes with live agent streaming.</p>
      </header>

      <Tabs tabs={visibleTabs} activeTab={activeTab} onSelect={setActiveTab} />

      <TabPanel id="run-a-command" activeTab={activeTab}>
      <section className="openspec-shell-panel">
        <h2>Run a command</h2>
        <div className="openspec-shell-grid">
          <label className="openspec-shell-field">
            Workspace root (cwd)
            <input
              type="text"
              value={cwd}
              onChange={(e) => handleCwdChange(e.target.value)}
              onBlur={() => void handleLoadOverview()}
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
        <p className="openspec-shell-note">
          Tip: changing <strong>Workspace root (cwd)</strong> auto-fills <strong>Change directory</strong> as
          <code> openspec/changes</code>.
        </p>
        {workspaceRootSyncError ? <p className="openspec-shell-note">Workspace root sync failed: {workspaceRootSyncError}</p> : null}
        {canInitialize ? (
          <div className="openspec-shell-panel">
            <p className="openspec-shell-note">
              OpenSpec initialization artifacts were not found in this workspace. Select AI tools and initialize.
            </p>
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
            <div className="openspec-ai-panel-controls">
              <button type="button" onClick={handleInitializeOpenSpec} disabled={initLoading || cwd.trim().length === 0}>
                {initLoading ? "Initializing..." : "Initialize OpenSpec"}
              </button>
            </div>
            {initMessage ? <p className="openspec-shell-note">{initMessage}</p> : null}
          </div>
        ) : null}
        {cwd.trim().length > 0 && changeDir.trim().length > 0 ? (
          <AiPanel
            transport={transport}
            cwd={cwd}
            changeDir={changeDir}
            detectedAgents={detectedAgents}
            onRefreshAgents={() => void handleRefreshAgents()}
            onRunTerminal={isStandaloneHost ? handleRunTerminal : undefined}
          />
        ) : (
          <p>Enter cwd and change directory to enable the AI panel.</p>
        )}
      </section>
      </TabPanel>

      {visibleTabIds.has("processes") && (
      <TabPanel id="processes" activeTab={activeTab}>
      <section className="openspec-shell-panel">
        <h2>Processes and recovery</h2>
        <p className="openspec-shell-note">Review persisted runs, checkpoint coverage, rollback conflicts, and retained history.</p>
        {cwd.trim().length > 0 ? <ProcessesView api={processesApi} /> : <p>Enter workspace root to load processes.</p>}
      </section>
      </TabPanel>
      )}

      {visibleTabIds.has("diff-preview") && (
      <TabPanel id="diff-preview" activeTab={activeTab}>
      <section className="openspec-shell-panel">
        <h2>Diff preview</h2>
        <p>
          Standalone-only rendering (see <code>shared-ui</code> design — extension delegates this to{" "}
          <code>vscode.diff</code>).
        </p>
        <ChangeDiff
          before={"- [ ] task one\n- [ ] task two\n"}
          after={"- [x] task one\n- [ ] task two\n"}
          beforeLabel="before"
          afterLabel="after"
        />
      </section>
      </TabPanel>
      )}

      {visibleTabIds.has("overview") && (
      <TabPanel id="overview" activeTab={activeTab}>
      <section className="openspec-shell-panel">
        <h2>OpenSpec view summary</h2>
        <p className="openspec-shell-note">
          Parsed, visual summary of repository state. Use this as a readable companion to terminal <code>openspec view</code>.
        </p>
        <div className="openspec-ai-panel-controls">
          <button type="button" onClick={handleLoadOverview} disabled={overviewLoading || cwd.trim().length === 0}>
            {overviewLoading ? "Loading..." : "Load summary"}
          </button>
        </div>

        {overviewError ? <p className="openspec-overview-error">Failed to load summary: {overviewError}</p> : null}

        {overview ? (
          <div className="openspec-overview" data-testid="openspec-overview">
            <p className="openspec-overview-meta">
              Root: <strong>{overview.root.path}</strong> ({overview.root.source}) | Changes: <strong>{overview.changes.length}</strong>
              {" "}
              | Specs: <strong>{overview.specs.length}</strong>
            </p>

            {overview.changes.length > 0 ? (
              <div className="openspec-overview-block">
                <h3>Changes</h3>
                <table className="openspec-overview-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Tasks</th>
                      <th>Last modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...overview.changes]
                      .sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified))
                      .map((change) => (
                        <tr key={change.name}>
                          <td>{change.name}</td>
                          <td>{change.status}</td>
                          <td>
                            {change.completedTasks}/{change.totalTasks}
                          </td>
                          <td>{change.lastModified}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {overview.specs.length > 0 ? (
              <div className="openspec-overview-block">
                <h3>Specs</h3>
                <table className="openspec-overview-table">
                  <thead>
                    <tr>
                      <th>Spec</th>
                      <th>Requirements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.specs.map((spec) => (
                      <tr key={spec.id}>
                        <td>{spec.id}</td>
                        <td>{spec.requirementCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      </TabPanel>
      )}

      {visibleTabIds.has("change-editor") && (
      <TabPanel id="change-editor" activeTab={activeTab}>
      <section className="openspec-shell-panel">
        <h2>Change Editor</h2>
        <p className="openspec-shell-note">
          Create and edit change markdown artifacts before implementation.
        </p>

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

        <div className="openspec-ai-panel-controls">
          <button type="button" onClick={handleCreateChange} disabled={editorCreating || cwd.trim().length === 0}>
            {editorCreating ? "Creating..." : "Create change"}
          </button>

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

          <button
            type="button"
            onClick={() => void loadChangeEditor(editorChangeName)}
            disabled={editorLoading || editorChangeName.trim().length === 0}
          >
            {editorLoading ? "Loading..." : "Load change"}
          </button>
        </div>

        {editorMessage ? <p className="openspec-shell-note">{editorMessage}</p> : null}

        <div className="openspec-editor-tabs">
          {(["proposal", "design", "tasks", "spec"] as EditorTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={tab === editorTab ? "is-active" : ""}
              onClick={() => setEditorTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {editorTab === "tasks" ? (
          <div className="openspec-ai-panel-controls">
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
            <button
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
          <p className="openspec-shell-note">{archivedTemplateMessage}</p>
        ) : null}

        <div className="openspec-editor-grid">
          <label className="openspec-shell-field">
            Markdown ({editorTab})
            <textarea
              className="openspec-editor-textarea"
              value={editorFiles[editorTab]}
              onChange={(e) => {
                const value = e.target.value;
                setEditorFiles((prev) => ({ ...prev, [editorTab]: value }));
              }}
              placeholder="Write markdown content"
            />
          </label>

          <div>
            <p className="openspec-shell-note">Preview</p>
            <MarkdownPreview content={editorFiles[editorTab]} />
          </div>
        </div>

        <div className="openspec-ai-panel-controls">
          <button
            type="button"
            onClick={handleSaveEditor}
            disabled={editorSaving || editorChangeName.trim().length === 0 || editorRevision.length === 0}
          >
            {editorSaving ? "Saving..." : "Save markdown"}
          </button>
        </div>
      </section>
      </TabPanel>
      )}

      {visibleTabIds.has("templates") && (
      <TabPanel id="templates" activeTab={activeTab}>
      <section className="openspec-shell-panel">
        <h2>Templates</h2>
        <p className="openspec-shell-note">
          Built-in and project-level ({"openspec/templates/"}) starting points for new changes. "Customize" forks a
          built-in template into your project, keeping a backlink to the built-in version it came from.
        </p>
        <div className="openspec-ai-panel-controls">
          <button type="button" onClick={() => void handleLoadTemplates()} disabled={templatesLoading || cwd.trim().length === 0}>
            {templatesLoading ? "Loading..." : "Load templates"}
          </button>
        </div>

        {templatesError ? <p className="openspec-overview-error">Failed to load templates: {templatesError}</p> : null}

        {templates ? (
          <table className="openspec-overview-table" data-testid="templates-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Origin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {allTemplates.map((template, index) => {
                const previousCategory = index > 0 ? allTemplates[index - 1]?.manifest.category : undefined;
                const isNewCategory = template.manifest.category !== previousCategory;
                return (
                <Fragment key={template.key}>
                  {isNewCategory ? (
                    <tr className="openspec-overview-table-subheader" data-testid={`template-category-${template.manifest.category}`}>
                      <td colSpan={4}>{template.manifest.category}</td>
                    </tr>
                  ) : null}
                  <tr data-testid={`template-row-${template.key}`}>
                  <td>
                    {template.manifest.title}
                    {template.manifest.forkedFrom ? " (customized)" : ""}
                  </td>
                  <td>{template.manifest.category}</td>
                  <td>{template.origin}</td>
                  <td className="openspec-ai-panel-controls">
                    <button type="button" onClick={() => handleSelectTemplate(template)}>
                      Select
                    </button>
                    {template.origin === "built-in" && !isTemplateCustomized(template.manifest.id) ? (
                      <button
                        type="button"
                        onClick={() => void handleCustomizeTemplate(template.manifest.id)}
                        disabled={templateActionLoading}
                      >
                        Customize
                      </button>
                    ) : null}
                    {template.origin === "project" ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteProjectTemplate(template.manifest.id)}
                        disabled={templateActionLoading}
                      >
                        Delete
                      </button>
                    ) : null}
                  </td>
                  </tr>
                </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : null}

        {selectedTemplate ? (
          <div className="openspec-shell-panel">
            <h3>{selectedTemplate.manifest.title}</h3>
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
            <div className="openspec-ai-panel-controls">
              <button
                type="button"
                onClick={() => void handleInsertTemplateIntoChange()}
                disabled={templateActionLoading || templateInsertTargetChange.trim().length === 0}
              >
                {templateActionLoading ? "Inserting..." : "Insert into change"}
              </button>
            </div>
          </div>
        ) : null}

        {templateActionMessage ? <p className="openspec-shell-note">{templateActionMessage}</p> : null}
      </section>
      </TabPanel>
      )}

      {visibleTabIds.has("timeline") && (
      <TabPanel id="timeline" activeTab={activeTab}>
      <section className="openspec-shell-panel">
        <h2>Timeline</h2>
        <p className="openspec-shell-note">
          See a change's proposal/design/spec and its tasks, positioned by
          when git shows each was completed.
        </p>

        <div className="openspec-ai-panel-controls">
          <select
            aria-label="Change to show a timeline for"
            value={timelineSelection}
            onChange={(e) => setTimelineSelection(e.target.value)}
            disabled={(overview?.changes.length ?? 0) + (overview?.archivedChanges.length ?? 0) === 0}
          >
            <option value="">Select change</option>
            {(overview?.changes ?? []).map((change) => (
              <option key={`active:${change.name}`} value={`active:${change.name}`}>{change.name}</option>
            ))}
            {(overview?.archivedChanges ?? []).map((name) => (
              <option key={`archived:${name}`} value={`archived:${name}`}>{name} (archived)</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadTimeline()}
            disabled={timelineLoading || timelineSelection.trim().length === 0}
          >
            {timelineLoading ? "Loading..." : "Load timeline"}
          </button>
        </div>

        {timelineMessage ? <p className="openspec-shell-note">{timelineMessage}</p> : null}
        {timeline ? <ChangeTimelineView timeline={timeline} /> : null}
      </section>
      </TabPanel>
      )}

      {isStandaloneHost ? (
        <footer className="openspec-shell-version-footer" data-testid="version-footer">
          core {versions?.core ?? "…"} · server {versions?.server ?? "…"} · webui {__OPENSPEC_UI_WEBUI_VERSION__}
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
