// Entry point for the editor's harness settings panels: one panel for the
// global file, and one per change. Not part of the package's public API —
// bootstrap code for `packages/extension`'s build.
//
// The settings view used to be mounted inside the AI panel, and a panel
// opened from a change learned the change's name only after it had
// mounted, so the form never loaded it. These panels put the scope and the
// change's name in the root element the page is rendered with, and the
// view has them on its first render. See a-change-is-configured-from-the-change.

import { createRoot } from "react-dom/client";
import { useEffect, useMemo } from "react";
import type { VsCodeApiLike } from "./transport/message-bridge-transport.js";
import { createBridgeRequester } from "./bridge-request.js";
import { ChangeHarnessSettingsView } from "./components/ChangeHarnessSettingsView.js";
import { GlobalHarnessSettingsView } from "./components/GlobalHarnessSettingsView.js";
import type { HarnessSettingsApi } from "./components/harness-settings-parts.js";
import { shellThemeCss, vscodeThemeCss } from "./shell-ui.js";

/** Posted by a change's panel when someone asks for the global defaults.
 * The host answers by opening the global panel. */
export const EDIT_GLOBAL_HARNESS_MESSAGE_TYPE = "openspec-ui/edit-global-harness";

declare function acquireVsCodeApi(): VsCodeApiLike;

function HarnessSettingsApp({ scope, changeName }: { scope: "global" | "change"; changeName: string }) {
  const vscodeApi = useMemo(() => acquireVsCodeApi(), []);
  const bridge = useMemo(() => createBridgeRequester(vscodeApi), [vscodeApi]);
  useEffect(() => () => bridge.dispose(), [bridge]);
  const api = useMemo<HarnessSettingsApi>(() => ({
    listCustomAgents: () => bridge.request("custom-agents/list"),
    resolveGlobal: () => bridge.request("harness/resolve-global"),
    writeGlobal: (config) => bridge.request("harness/write-global", { config }),
    readChangeOverride: (name) => bridge.request("harness/read-change-override", { changeName: name }),
    writeChangeOverride: (name, config) => bridge.request("harness/write-change-override", { changeName: name, config }),
  }), [bridge]);

  return (
    <div className="openspec-extension-app">
      <style>{[shellThemeCss, vscodeThemeCss].join(" ")}</style>
      <section className="openspec-shell-panel">
        {scope === "change" && changeName.length > 0 ? (
          <>
            <h2>{`Harness settings for ${changeName}`}</h2>
            <ChangeHarnessSettingsView
              api={api}
              changeName={changeName}
              onEditGlobal={() => vscodeApi.postMessage({ type: EDIT_GLOBAL_HARNESS_MESSAGE_TYPE })}
            />
          </>
        ) : (
          <>
            <h2>Harness settings</h2>
            <p className="openspec-shell-note">
              The global defaults every change starts from. A change's own settings open from that change:
              Configure Harness for this Change, in the Changes tree.
            </p>
            <GlobalHarnessSettingsView api={api} />
          </>
        )}
      </section>
    </div>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("harness-settings-entry: #root element not found");
}
const scope = container.dataset.scope === "change" ? "change" : "global";
createRoot(container).render(<HarnessSettingsApp scope={scope} changeName={container.dataset.changeName ?? ""} />);
