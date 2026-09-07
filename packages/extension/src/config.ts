// Reads extension settings (`contributes.configuration` in package.json).

import * as vscode from "vscode";
import type { CheckScriptSettings } from "@openspec-ui/core";

export interface ExtensionConfig {
  /** `openspec-ui.transport.localServer.enabled` — the optional local
   * server mode, disabled by default (see spec.md, "Localhost
   * server mode is optional and opt-in"). */
  localServerEnabled: boolean;
  /** `openspec-ui.checks` — names the npm script each check should run,
   * per check. See check-script-resolution.ts in `@openspec-ui/core`:
   * this wins over the `osui-<name>`/`<name>` conventions when set. */
  checks: CheckScriptSettings;
  /** `openspec-ui.followSelectionInChangeGraph` — off by default. See
   * follow-selection.ts and design.md, "locating is a request; following
   * is opt-in": the graph shows only changes that state a relation, so
   * for most changes there is nothing for a followed selection to do. */
  followSelectionInChangeGraph: boolean;
}

export function readConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration("openspec-ui");
  return {
    localServerEnabled: config.get<boolean>("transport.localServer.enabled", false),
    checks: config.get<CheckScriptSettings>("checks", {}),
    followSelectionInChangeGraph: config.get<boolean>("followSelectionInChangeGraph", false),
  };
}

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
