// Точка входа для standalone-браузерного шелла (см.
// openspec/changes/standalone-app/tasks.md 2.1). Не часть публичного API
// пакета (не реэкспортируется из index.ts) — это bootstrap-код конкретно
// для сборки `packages/server` (см. scripts/build-client.mjs), а не
// библиотечный код, переиспользуемый в extension.

import { createRoot } from "react-dom/client";
import { useMemo, useState } from "react";
import { FetchTransport } from "./transport/fetch-transport.js";
import { AiPanel } from "./components/AiPanel.js";
import { ChangeDiff } from "./components/ChangeDiff.js";

function StandaloneApp() {
  const [cwd, setCwd] = useState("");
  const [changeDir, setChangeDir] = useState("");
  const transport = useMemo(() => new FetchTransport({ baseUrl: window.location.origin }), []);

  return (
    <div className="openspec-standalone-app">
      <h1>OpenSpec UI</h1>

      <section>
        <h2>Run a command</h2>
        <label>
          Workspace root (cwd)
          <input
            type="text"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="C:\path\to\repo"
          />
        </label>
        <label>
          Change directory
          <input
            type="text"
            value={changeDir}
            onChange={(e) => setChangeDir(e.target.value)}
            placeholder="C:\path\to\repo\openspec\changes\my-change"
          />
        </label>
        {cwd.trim().length > 0 && changeDir.trim().length > 0 ? (
          <AiPanel transport={transport} cwd={cwd} changeDir={changeDir} />
        ) : (
          <p>Enter cwd and change directory to enable the AI panel.</p>
        )}
      </section>

      <section>
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
