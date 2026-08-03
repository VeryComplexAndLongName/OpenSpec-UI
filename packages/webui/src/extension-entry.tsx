// Точка входа для Webview VS Code extension'а (см.
// openspec/changes/vscode-extension/tasks.md 2.2). Не часть публичного API
// пакета — bootstrap-код для сборки `packages/extension`
// (scripts/build-webview.mjs), не библиотечный код.
//
// В отличие от standalone-entry.tsx, здесь НЕТ `ChangeDiff` — extension
// делегирует diff нативному `vscode.diff` (см. spec.md, "Native diff UI is
// used for review... SHALL NOT render custom diff UI inside Webview for
// extension mode").

import { createRoot } from "react-dom/client";
import { useMemo, useState } from "react";
import { MessageBridgeTransport, type VsCodeApiLike } from "./transport/message-bridge-transport.js";
import { AiPanel } from "./components/AiPanel.js";

declare function acquireVsCodeApi(): VsCodeApiLike;

function ExtensionApp() {
  const [cwd, setCwd] = useState("");
  const [changeDir, setChangeDir] = useState("");
  const transport = useMemo(() => new MessageBridgeTransport({ vscodeApi: acquireVsCodeApi() }), []);

  return (
    <div className="openspec-extension-app">
      <h1>OpenSpec UI</h1>
      <label>
        Workspace root (cwd)
        <input type="text" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="C:\path\to\repo" />
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
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("extension-entry: #root element not found");
}
createRoot(container).render(<ExtensionApp />);
