// Entry point for the VS Code extension's Webview (see
// openspec/changes/vscode-extension/tasks.md 2.2). Not part of the
// package's public API — bootstrap code for building `packages/extension`
// (scripts/build-webview.mjs), not library code.
//
// Unlike standalone-entry.tsx, there is NO `ChangeDiff` here — the
// extension delegates diffing to native `vscode.diff` (see spec.md,
// "Native diff UI is used for review... SHALL NOT render custom diff UI
// inside Webview for extension mode").

import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { MessageBridgeTransport, type VsCodeApiLike } from "./transport/message-bridge-transport.js";
import { AiPanel } from "./components/AiPanel.js";
import { HarnessChainPanel } from "./components/HarnessChainPanel.js";
import { buildDefaultChangeDir, shellThemeCss, vscodeThemeCss } from "./shell-ui.js";
import {
  isDashboardContextMessage,
  resolveInitialDashboardContext,
  type DashboardContext,
} from "./extension-context.js";

const STORAGE_KEYS = {
  cwd: "openspec-ui:extension:cwd",
  changeDir: "openspec-ui:extension:changeDir",
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

declare function acquireVsCodeApi(): VsCodeApiLike;

function ExtensionApp({ initialContext }: { initialContext: DashboardContext }) {
  const [cwd, setCwd] = useState(initialContext.cwd);
  const [changeDir, setChangeDir] = useState(initialContext.changeDir);
  const [detectedAgents, setDetectedAgents] = useState(initialContext.detectedAgents);
  const [stepAgents, setStepAgents] = useState(initialContext.stepAgents);
  const [startChain, setStartChain] = useState(initialContext.startChain ?? false);
  const transport = useMemo(() => new MessageBridgeTransport({ vscodeApi: acquireVsCodeApi() }), []);

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.cwd, cwd);
  }, [cwd]);

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.changeDir, changeDir);
  }, [changeDir]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isDashboardContextMessage(event.data)) return;
      setCwd(event.data.context.cwd);
      setChangeDir(event.data.context.changeDir);
      if (event.data.context.detectedAgents) {
        setDetectedAgents(event.data.context.detectedAgents);
      }
      if (event.data.context.stepAgents) {
        setStepAgents(event.data.context.stepAgents);
      }
      // Unlike detectedAgents/stepAgents (append-only follow-ups), this
      // must reset to false on a reveal that doesn't request a chain —
      // otherwise a later "open the normal picker" reveal on the same
      // (reused) panel would stay stuck showing HarnessChainPanel.
      setStartChain(event.data.context.startChain ?? false);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function handleCwdChange(nextCwd: string) {
    setCwd(nextCwd);
    setChangeDir(buildDefaultChangeDir(nextCwd));
  }

  return (
    <div className="openspec-extension-app">
      <style>{`${shellThemeCss}\n${vscodeThemeCss}`}</style>
      <header className="openspec-shell-headline">
        <h1>OpenSpec UI</h1>
        <p>VS Code webview runner for OpenSpec commands.</p>
      </header>
      <section className="openspec-shell-panel">
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
      </section>
      {cwd.trim().length > 0 && changeDir.trim().length > 0 ? (
        startChain ? (
          <HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} />
        ) : (
          <AiPanel transport={transport} cwd={cwd} changeDir={changeDir} detectedAgents={detectedAgents} stepAgents={stepAgents} />
        )
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
const initialContext = resolveInitialDashboardContext(container, (key) => readStoredValue(STORAGE_KEYS[key]));
createRoot(container).render(<ExtensionApp initialContext={initialContext} />);
