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
import { buildDefaultChangeDir, shellThemeCss } from "./shell-ui.js";

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

function StandaloneApp() {
  const [cwd, setCwd] = useState(() => readStoredValue(STORAGE_KEYS.cwd));
  const [changeDir, setChangeDir] = useState(() => readStoredValue(STORAGE_KEYS.changeDir));
  const [overview, setOverview] = useState<OpenSpecOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const transport = useMemo(() => new FetchTransport({ baseUrl: window.location.origin }), []);

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
      const response = await fetch(`${window.location.origin}/api/overview`, {
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
        {cwd.trim().length > 0 && changeDir.trim().length > 0 ? (
          <AiPanel transport={transport} cwd={cwd} changeDir={changeDir} />
        ) : (
          <p>Enter cwd and change directory to enable the AI panel.</p>
        )}
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
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("standalone-entry: #root element not found");
}
createRoot(container).render(<StandaloneApp />);
