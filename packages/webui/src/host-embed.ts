// Host-aware tab visibility for the standalone browser shell (see
// openspec/changes/standalone-shell-host-aware-tabs/design.md, "Signal
// mechanism"). Pure functions only — no DOM side effects — so this can be
// unit-tested directly, unlike standalone-entry.tsx itself (a bootstrap
// script that mounts to `#root` on import).
//
// `AiPanel.getLocalServerHtml` in the VS Code extension marks its iframe
// `src` with `?embed=vscode-local-server`; every other host (a plain
// standalone browser tab) leaves the `embed` query parameter absent.

import type { TabDefinition } from "./components/Tabs.js";

export const VSCODE_LOCAL_SERVER_EMBED_SIGNAL = "vscode-local-server";

export const ALL_TABS: readonly TabDefinition[] = [
  { id: "run-a-command", label: "Run a Command" },
  { id: "processes", label: "Processes and Recovery" },
  { id: "diff-preview", label: "Diff Preview" },
  { id: "overview", label: "OpenSpec view summary" },
  { id: "change-editor", label: "Change Editor" },
  { id: "templates", label: "Templates" },
  { id: "timeline", label: "Timeline" },
];

export const ALLOWED_TABS_VSCODE_EMBED: readonly string[] = ["run-a-command"];

export function readEmbedSignal(search: string): string {
  return new URLSearchParams(search).get("embed") ?? "";
}

export function computeVisibleTabs(embedSignal: string): readonly TabDefinition[] {
  if (embedSignal !== VSCODE_LOCAL_SERVER_EMBED_SIGNAL) return ALL_TABS;
  return ALL_TABS.filter((tab) => ALLOWED_TABS_VSCODE_EMBED.includes(tab.id));
}
