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
import { RunDialog } from "./components/RunDialog.js";
import { HarnessSettingsView, type HarnessSettingsApi } from "./components/HarnessSettingsView.js";
import { createBridgeRequester } from "./bridge-request.js";
import type { RunPathId } from "@openspec-ui/core/browser";
import { buildDefaultChangeDir, shellThemeCss, vscodeThemeCss } from "./shell-ui.js";
import {
  isDashboardContextMessage,
  resolveInitialDashboardContext,
  RUN_CHOICE_MESSAGE_TYPE,
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
  const [budget, setBudget] = useState(initialContext.budget);
  const [startChain, setStartChain] = useState(initialContext.startChain ?? false);
  // Seeded once, from the first render's context: the panel was opened to
  // run this change, so it starts on `implement` rather than `list`.
  // Deliberately not re-set by later context messages — the user may have
  // changed the command kind by then, and a follow-up message must not
  // undo that.
  const [runChange, setRunChange] = useState(initialContext.runChange ?? false);
  /** The dialog is showing while a plan is present and nobody has chosen
   * a path yet. Choosing one clears it and mounts what it chose — the
   * chain and the single-stage picker are both already here, so asking
   * the host to send a context back would be a round trip to change a
   * local variable. See run-dialog-in-the-panel. */
  const [runPlan, setRunPlan] = useState(initialContext.runPlan);
  const [changeName, setChangeName] = useState(initialContext.changeName);
  const [runNote, setRunNote] = useState(initialContext.runNote);
  /** The path a schedule already chose, taken as soon as the dialog is
   * on screen. The dialog is still rendered — its note says who asked
   * and how late — but it does not wait for a choice that was made when
   * the run was scheduled. See a-schedule-keeps-its-promise. */
  const [runPath, setRunPath] = useState(initialContext.runPath);
  const [showSettings, setShowSettings] = useState(initialContext.showSettings ?? false);
  const vscodeApi = useMemo(() => acquireVsCodeApi(), []);
  const transport = useMemo(() => new MessageBridgeTransport({ vscodeApi }), [vscodeApi]);
  // The settings view reads as well as writes, which the command/event
  // bridge cannot express. See harness-settings-in-the-panel.
  const bridge = useMemo(() => createBridgeRequester(vscodeApi), [vscodeApi]);
  useEffect(() => () => bridge.dispose(), [bridge]);
  const harnessSettingsApi = useMemo<HarnessSettingsApi>(() => ({
    listCustomAgents: () => bridge.request("custom-agents/list"),
    resolveGlobal: () => bridge.request("harness/resolve-global"),
    writeGlobal: (config) => bridge.request("harness/write-global", { config }),
    readChangeOverride: (name) => bridge.request("harness/read-change-override", { changeName: name }),
    writeChangeOverride: (name, config) => bridge.request("harness/write-change-override", { changeName: name, config }),
  }), [bridge]);

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
      if (event.data.context.budget) {
        setBudget(event.data.context.budget);
      }
      // Unlike detectedAgents/stepAgents (append-only follow-ups), this
      // must reset to false on a reveal that doesn't request a chain —
      // otherwise a later "open the normal picker" reveal on the same
      // (reused) panel would stay stuck showing HarnessChainPanel.
      setStartChain(event.data.context.startChain ?? false);
      // Same reason as `startChain`: a later reveal that is not a run
      // must not leave the dialog on screen, and a reveal that is one —
      // the host re-posting after a configuration was applied — must
      // bring it back with what the file now resolves to.
      setRunPlan(event.data.context.runPlan);
      setChangeName(event.data.context.changeName);
      setRunNote(event.data.context.runNote);
      setRunPath(event.data.context.runPath);
      if (event.data.context.runPlan) setRunChange(event.data.context.runChange ?? false);
      // Reset like the others: a later reveal that is not about settings
      // must not leave the form on screen.
      setShowSettings(event.data.context.showSettings ?? false);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function choosePath(path: RunPathId) {
    if (path === "vscode-agent") {
      // The only path the host has to carry out: opening a chat session
      // is not something this bundle can do.
      vscodeApi.postMessage({ type: RUN_CHOICE_MESSAGE_TYPE, choice: "vscode-agent" });
      return;
    }
    setStartChain(path === "chain");
    setRunChange(path !== "chain");
    setRunPlan(undefined);
  }

  // A scheduled run takes the path it was given rather than asking for
  // it a second time. Where the plan no longer offers that path the
  // dialog stays open for a choice, and its note says the configured
  // paths changed — the host leaves `runPath` off in that case.
  useEffect(() => {
    if (!runPath || !runPlan) return;
    if (!runPlan.offered.some((offered) => offered.id === runPath)) return;
    setRunPath(undefined);
    choosePath(runPath);
  }, [runPath, runPlan]);

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
      {showSettings ? (
        <HarnessSettingsView api={harnessSettingsApi} {...(changeName ? { initialChangeName: changeName } : {})} />
      ) : cwd.trim().length > 0 && changeDir.trim().length > 0 ? (
        runPlan ? (
          <RunDialog
            changeName={changeName ?? changeDir.split(/[\\/]+/).filter((part) => part.length > 0).pop() ?? ""}
            plan={runPlan}
            {...(runNote ? { note: runNote } : {})}
            onChoose={choosePath}
            onApplyTemplate={(template) => {
              // The id, not the configuration: the host has the list, and
              // it writes the file and posts the plan back.
              vscodeApi.postMessage({
                type: RUN_CHOICE_MESSAGE_TYPE,
                choice: "apply-template",
                templateId: template.id,
              });
            }}
            onDismiss={() => setRunPlan(undefined)}
          />
        ) : startChain ? (
          <HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} budget={budget} />
        ) : (
          <AiPanel transport={transport} cwd={cwd} changeDir={changeDir} detectedAgents={detectedAgents} stepAgents={stepAgents} initialCommandKind={runChange ? "implement" : undefined} />
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
