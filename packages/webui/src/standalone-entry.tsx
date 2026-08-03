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
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("standalone-entry: #root element not found");
}
createRoot(container).render(<StandaloneApp />);
