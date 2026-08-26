## Why

Second of three changes building the "change timeline" feature (see
`2026-08-26-add-change-timeline-data-layer` for the shared data layer).
This change adds the actual single-change view the user asked for: a
context-menu item on any change (active or archived) that opens a view
showing that change's proposal/design/spec at the top, then its tasks
positioned by completion date — the concrete design confirmed across
several rounds of discussion on 2026-08-26 (tab-based, oldest date at
top, undated/pending tasks marked distinctly, click a task to see its
full text).

## What Changes

- Add `packages/webui/src/components/ChangeTimelineView.tsx`: a
  presentational, transport-agnostic component (props only, matching
  `ArchiveList`/`ChangesList`'s convention) rendering proposal/design/
  spec markdown via the existing `renderMarkdown`, then tasks sorted
  oldest-dated first, pending/undated last, each expandable to show its
  full text on click.
- Standalone app: add a "Timeline" tab (`ALL_TABS` in `host-embed.ts`),
  with a change picker (active + archived) and a `loadChangeTimeline`
  REST call — no extension involvement, reuses Change 1's data layer
  directly.
- VS Code extension: a new per-item context-menu command,
  `openspec-ui.showChangeTimeline` (both active and archived tree
  items), whose handler calls `getChangeTimeline` **directly** (the
  extension host already imports `@openspec-ui/core` per ADR-0001's
  primary mode) and opens a new, purpose-built webview
  (`TimelineWebviewPanel`) with the already-computed data embedded in
  its initial HTML — no REST, no message bridge, no reuse of the
  existing `AiPanel` (which is specifically built around streaming
  agent-run commands, a poor fit for a one-shot data render).
- New minimal webui entry point, `timeline-entry.tsx`, bundled as
  `dist/timeline.js` (new esbuild target in `build-options.mjs`),
  rendering `ChangeTimelineView` from the data the host embedded as
  `window.__OPENSPEC_UI_TIMELINE__` — no fetch, no message listener.

## Capabilities

### Modified Capabilities

- `vscode-extension`: adds a Requirement for the per-change timeline
  webview command.
- `standalone-app`: adds a Requirement for the Timeline tab.

## Impact

- `packages/webui/src/components/ChangeTimelineView.tsx` (new)
- `packages/webui/src/timeline-entry.tsx` (new)
- `packages/webui/src/host-embed.ts`
- `packages/webui/src/standalone-entry.tsx`
- `packages/extension/src/webview/timeline-panel.ts` (new)
- `packages/extension/src/commands.ts`, `package.json`
- `packages/extension/scripts/build-options.mjs`,
  `packages/extension/src/test/run.mjs`
- `.changeset/*.md` (new changeset file)
