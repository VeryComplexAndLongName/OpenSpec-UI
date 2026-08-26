## 1. Log-scale util

- [x] 1.1 Before writing any component, validate the log-scale
  direction against real data: a throwaway HTML/Playwright sketch using
  this repository's own real archived-change timestamps (a dense
  8-change cluster plus sparser later changes), comparing linear,
  "log from range start," and "log from range end." Confirmed "from
  start" spreads the dense cluster into readable points; "from end"
  compressed it tighter than linear.
- [x] 1.2 Add `packages/webui/src/timeline-scale.ts` (`logPosition`)
  implementing the confirmed direction, clamped to `[0, 100]`.
- [x] 1.3 Add `timeline-scale.test.ts`.

## 2. Webui: multi-change component

- [x] 2.1 Add `packages/webui/src/components/MultiChangeTimelineView.tsx`:
  props `{ timelines, rangeStart, rangeEnd }`, one lane per timeline,
  created/task/archived points plotted via `logPosition`. Archived
  points anchored to end-of-day (`T23:59:59.999Z`), not midnight (see
  design.md).
- [x] 2.2 Add `MultiChangeTimelineView.test.tsx`.
- [x] 2.3 Add `.openspec-timeline-*`/`.openspec-multi-timeline-*` CSS to
  `packages/webui/src/shell-ui.ts` — found missing entirely during
  verification; required for the positioned-axis layout to render at
  all, not just cosmetic (see design.md).

## 3. Standalone app: compare-changes mode

- [x] 3.1 Add a "Single change" / "Compare changes" mode toggle within
  the existing Timeline tab in `standalone-entry.tsx`: date-range
  `<input type="date">` pair, a multi-select change list, and
  `loadChangeTimelines` via real REST.

## 4. Extension: global comparison command

- [x] 4.1 Add `pickChangesForTimeline` (multi-select `showQuickPick`
  over active and archived changes) and `computeDefaultRange`
  (data-derived date range — no manual date entry, see design.md) to
  `commands.ts`.
- [x] 4.2 Register `openspec-ui.showAllChangesTimeline` (Command
  Palette only, no tree item, matching `openspec-ui.openspecView`'s
  precedent), calling `getChangeTimelines` directly and
  `timelinePanel.showMulti(...)`.
- [x] 4.3 Add `showMulti(...)` to `TimelineWebviewPanel`, reusing the
  same not-a-singleton, embed-in-initial-HTML approach as `show()`.
- [x] 4.4 Extend `timeline-entry.tsx` to render whichever of
  `window.__OPENSPEC_UI_TIMELINE__` / `__OPENSPEC_UI_MULTI_TIMELINE__`
  is present.
- [x] 4.5 Add `contributes.commands` entry in `package.json`.
- [x] 4.6 Add tests to `commands.test.ts`: picks across active and
  archived, computes the expected default range, calls `showMulti`;
  does nothing when no changes are picked.

## 5. Verification

- [x] 5.1 `npm run typecheck` and `npm run lint` (including
  `lint:english`) pass workspace-wide.
- [x] 5.2 `npm run test` passes workspace-wide, including all new test
  files.
- [x] 5.3 Rebuild the VSIX (`npm run package --workspace
  openspec-ui-vscode`) and confirm it packages without error.
- [x] 5.4 Live smoke test: same pre-existing, environment-specific
  `@vscode/test-electron` failure reproduces on this machine
  (documented since `2026-08-26-signal-run-completion`, unrelated to
  this change). As a substitute, verified the built `dist/timeline.js`
  bundle in a real Chromium browser (Playwright) loading real
  `getChangeTimelines` data for 7 of this repository's own archived
  changes: correct lane count, correct point count, zero console
  errors, and — after finding and fixing the missing CSS — confirmed
  via computed styles that `position`/`left`/`transform` resolve
  correctly on each plotted point.
- [x] 5.5 Propose a changeset (`npx changeset`) for `openspec-ui-vscode`
  and `@openspec-ui/webui` (both minor: new capability, no breaking
  change) instead of hand-editing `version`/`CHANGELOG.md`; apply it
  via `npx changeset version`.
- [x] 5.6 Run `openspec change validate --strict add-multi-change-timeline-view`.
