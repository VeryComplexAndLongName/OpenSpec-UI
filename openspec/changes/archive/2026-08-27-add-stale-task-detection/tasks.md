## 1. Core: data layer and staleness logic

- [x] 1.1 Add `ChangeTimelineTask.lastTouchedDate` to
  `change-timeline.ts`, always populated from the existing blame map
  (done or not) — distinct from `date`, which stays completion-only.
- [x] 1.2 Update `change-timeline.test.ts` for the new field.
- [x] 1.3 Add `packages/core/src/stale-tasks.ts`
  (`DEFAULT_STALE_TASK_THRESHOLD_DAYS`, `isTaskStale`, `findStaleTasks`)
  and `stale-tasks.test.ts`. Pure date math, no git/fs.
- [x] 1.4 Export from `index.ts`; export the pure logic plus the
  `ChangeTimeline*` types (type-only) from `browser.ts`.

## 2. Webui: shared component and standalone UI

- [x] 2.1 Re-point `change-timeline-client.ts` at
  `@openspec-ui/core/browser`'s real types instead of a hand-duplicated
  copy (which had already drifted once).
- [x] 2.2 Add `staleThresholdDays`/`now` props to `ChangeTimelineView`;
  flag stale pending tasks distinctly (marker + message), matching CSS
  in `shell-ui.ts`.
- [x] 2.3 Add tests for stale/fresh rendering with a deterministic
  `now`.
- [x] 2.4 Add a "Stale after (days)" number input to the standalone
  Timeline tab's single-change mode, defaulting to
  `DEFAULT_STALE_TASK_THRESHOLD_DAYS`.

## 3. Extension: setting and webview wiring

- [x] 3.1 Add `openspec-ui.staleTaskThresholdDays` to
  `contributes.configuration` in `package.json` (default 14).
- [x] 3.2 `openspec-ui.showChangeTimeline` reads the setting and passes
  it to `TimelineWebviewPanel.show(...)`.
- [x] 3.3 `TimelineWebviewPanel` embeds it as its own global
  (`window.__OPENSPEC_UI_STALE_THRESHOLD_DAYS__`), same nonce'd
  mechanism as the timeline data; `timeline-entry.tsx` reads it and
  passes it to `ChangeTimelineView`.
- [x] 3.4 Update `timeline-panel.test.ts` and `commands.test.ts` for
  the new parameter/setting (added a dedicated test asserting the
  setting is actually read, not just defaulted).

## 4. Verification

- [x] 4.1 `npm run typecheck` and `npm run lint` (including
  `lint:english`) pass workspace-wide.
- [x] 4.2 `npm run test` passes workspace-wide, including all updated/
  new test files.
- [x] 4.3 Rebuild the VSIX (`npm run package --workspace
  openspec-ui-vscode`) and confirm it packages without error.
- [x] 4.4 Manual verification against the *real* CSP shape (not a bare
  unrestricted page — see design.md's Verification note): constructed
  HTML matching `TimelineWebviewPanel.getHtml()` exactly, with a
  synthetic genuinely-stale task and a fresh pending task; confirmed
  zero console errors and correct stale/fresh visual distinction via a
  real Chromium screenshot.
- [x] 4.5 Propose a changeset (`npx changeset`) for `@openspec-ui/core`,
  `@openspec-ui/webui`, and `openspec-ui-vscode` (all minor: new
  capability, no breaking change) instead of hand-editing `version`/
  `CHANGELOG.md`; apply it via `npx changeset version`.
- [x] 4.6 Run `openspec change validate --strict add-stale-task-detection`.
