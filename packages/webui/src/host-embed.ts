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
  { id: "run-a-command", label: "Run a Command", short: "Run" },
  { id: "processes", label: "Processes and Recovery", short: "Processes" },
  { id: "diff-preview", label: "Diff Preview", short: "Diff" },
  { id: "overview", label: "OpenSpec view summary", short: "Summary" },
  { id: "change-editor", label: "Change Editor", short: "Editor" },
  { id: "templates", label: "Templates", short: "Templates" },
  { id: "timeline", label: "Timeline", short: "Timeline" },
  { id: "pipeline", label: "Pipeline", short: "Pipeline" },
  { id: "harness-settings", label: "Harness Settings", short: "Harness" },
];

export const ALLOWED_TABS_VSCODE_EMBED: readonly string[] = ["run-a-command", "pipeline"];

export function readEmbedSignal(search: string): string {
  return new URLSearchParams(search).get("embed") ?? "";
}

export function computeVisibleTabs(embedSignal: string): readonly TabDefinition[] {
  if (embedSignal !== VSCODE_LOCAL_SERVER_EMBED_SIGNAL) return ALL_TABS;
  return ALL_TABS.filter((tab) => ALLOWED_TABS_VSCODE_EMBED.includes(tab.id));
}

/** The light or dark a framing editor names with `theme=`, or `undefined`
 * when it names neither. A page served by the local server cannot read the
 * editor's colours, and without this it followed the operating system: a
 * dark editor framed a light Pipeline
 * (the-pipeline-answers-while-a-run-works 5.7). */
export function embedTheme(search: string): "light" | "dark" | undefined {
  const named = new URLSearchParams(search).get("theme");
  return named === "light" || named === "dark" ? named : undefined;
}

/** The tab a `tab=` URL parameter names, when it is among `visibleTabs`;
 * the first visible tab otherwise (an absent, unknown, or hidden name). */
export function initialTab(search: string, visibleTabs: readonly TabDefinition[]): string {
  const requested = new URLSearchParams(search).get("tab");
  if (requested !== null && visibleTabs.some((tab) => tab.id === requested)) return requested;
  return visibleTabs[0]?.id ?? "";
}
