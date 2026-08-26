## 1. Webui: shared presentational component

- [x] 1.1 Add `packages/webui/src/components/ChangeTimelineView.tsx`:
  props `{ timeline: ChangeTimeline }`, renders proposal/design/spec via
  `renderMarkdown`, tasks sorted oldest-dated first then pending/undated
  (original order preserved within each group), each task expandable on
  click to show its full text.
- [x] 1.2 Add `ChangeTimelineView.test.tsx`.

## 2. Standalone app: Timeline tab

- [x] 2.1 Add `{ id: "timeline", label: "Timeline" }` to `ALL_TABS` in
  `host-embed.ts`.
- [x] 2.2 Add a `TabPanel` in `standalone-entry.tsx`: a change picker
  (active + archived, from `overview`), `loadChangeTimeline` via real
  REST, renders `ChangeTimelineView`.

## 3. Extension: per-change context-menu command and webview

- [x] 3.1 Add `packages/extension/src/webview/timeline-panel.ts`
  (`TimelineWebviewPanel`): not a singleton (unlike `AiPanel`) — each
  `.show()` call opens a new tab. Embeds the already-computed
  `ChangeTimeline` as `window.__OPENSPEC_UI_TIMELINE__` in the initial
  HTML (JSON-escaped against `</script>` injection), not posted as a
  follow-up message (see design.md, "Data is embedded...").
- [x] 3.2 Add `packages/webui/src/timeline-entry.tsx`: reads the
  embedded global, renders `ChangeTimelineView`. No fetch, no message
  listener.
- [x] 3.3 Add `timelineWebviewBuildOptions()` to
  `packages/extension/scripts/build-options.mjs`; wire it into
  `build.mjs` and `src/test/run.mjs`.
- [x] 3.4 Register `openspec-ui.showChangeTimeline` in `commands.ts`
  (`item?: ChangeTreeItem`, both active and archived), calling
  `getChangeTimeline` directly (no REST) and `timelinePanel.show(...)`.
- [x] 3.5 Add `contributes.commands` and a `view/item/context` menu
  entry (`viewItem == openspec-ui.activeChange ||
  viewItem == openspec-ui.archivedChange`) in `package.json`.
- [x] 3.6 Add tests to `commands.test.ts`: fetches and shows for an
  active change, fetches with `archived: true` for an archived change,
  reports an error and does not open a panel when the fetch fails.

## 4. Verification

- [x] 4.1 `npm run typecheck` and `npm run lint` (including
  `lint:english`) pass workspace-wide.
- [x] 4.2 `npm run test` passes workspace-wide, including all new test
  files.
- [x] 4.3 Rebuild the VSIX (`npm run package --workspace
  openspec-ui-vscode`) and confirm `dist/timeline.js` is included and
  the package succeeds.
- [x] 4.4 Live smoke test: `npm run test:integration --workspace
  openspec-ui-vscode` reproduces the same pre-existing, environment-
  specific `@vscode/test-electron` failure already documented in
  `2026-08-26-signal-run-completion`'s tasks.md (unrelated to this
  change — reproduces identically against unmodified `main`). As a
  substitute, verified the actual built `dist/timeline.js` bundle in a
  real Chromium browser (Playwright) loading real `getChangeTimeline`
  data from this repository's own archived changes: correct heading,
  correct task count/dates, proposal content rendered, zero console
  errors — screenshot inspected visually.
- [x] 4.5 Propose a changeset (`npx changeset`) for
  `openspec-ui-vscode` and `@openspec-ui/webui` (both minor: new
  capability, no breaking change) instead of hand-editing `version`/
  `CHANGELOG.md`; apply it via `npx changeset version`.
- [x] 4.6 Run `openspec change validate --strict add-change-timeline-view`.
