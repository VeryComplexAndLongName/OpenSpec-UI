// Точка входа для standalone-браузерного шелла (см.
// openspec/changes/standalone-app/tasks.md 2.1). Не часть публичного API
// пакета (не реэкспортируется из index.ts) — это bootstrap-код конкретно
// для сборки `packages/server` (см. scripts/build-client.mjs), а не
// библиотечный код, переиспользуемый в extension.

import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { FetchTransport } from "./transport/fetch-transport.js";
import { AiPanel } from "./components/AiPanel.js";
import { ChangeDiff } from "./components/ChangeDiff.js";
import { ProcessesView, type ProcessesApi } from "./components/ProcessesView.js";
import { buildDefaultChangeDir, shellThemeCss } from "./shell-ui.js";
import { renderMarkdown } from "./markdown.js";
import {
  ChangeEditorSaveConflictError,
  loadChangeEditorDocument,
  saveChangeEditorDocument,
  type ChangeEditorFiles,
} from "./change-editor-client.js";

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

function apiFetch(pathname: string, init: RequestInit): Promise<Response> {
  return fetch(`${window.location.origin}${pathname}`, {
    ...init,
    headers: {
      ...init.headers,
      "x-openspec-ui-token": accessToken,
    },
  });
}

function StandaloneApp() {
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
  const [initTools, setInitTools] = useState<string[]>(["github-copilot"]);
  const [initLoading, setInitLoading] = useState(false);
  const [initMessage, setInitMessage] = useState<string | null>(null);
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
    writeStoredValue(STORAGE_KEYS.cwd, cwd);
  }, [cwd]);

  useEffect(() => {
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
          <AiPanel transport={transport} cwd={cwd} changeDir={changeDir} />
        ) : (
          <p>Enter cwd and change directory to enable the AI panel.</p>
        )}
      </section>

      <section className="openspec-shell-panel">
        <h2>Processes and recovery</h2>
        <p className="openspec-shell-note">Review persisted runs, checkpoint coverage, rollback conflicts, and retained history.</p>
        {cwd.trim().length > 0 ? <ProcessesView api={processesApi} /> : <p>Enter workspace root to load processes.</p>}
      </section>

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
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("standalone-entry: #root element not found");
}
createRoot(container).render(<StandaloneApp />);
