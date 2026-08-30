## 1. Core: archived-change progress summary

- [x] 1.1 `packages/core/src/task-checklist.ts`: `ArchivedChangeSummary
  { completedTasks: number; totalTasks: number; lastModified: string }`,
  `getArchivedChangeSummary(workspaceRoot, changeName)` — reuses the
  existing `parseChecklist`/artifact-path resolution (same
  `discoverOpenSpecWorkspace`-sourced, allowlisted path pattern
  `findTasksArtifactPath` already uses), `fs.stat` on `tasks.md` (or the
  change directory if `tasks.md` doesn't exist) for `lastModified`.
- [x] 1.2 `task-checklist.test.ts`: correct counts/`lastModified` for an
  archived change with a mix of checked/unchecked tasks; `{0, 0}` and
  directory mtime when `tasks.md` is missing; `{0, 0}` and epoch
  fallback for an unknown change name. 3 new tests, 11/11 passing.
- [x] 1.3 Confirmed `getArchivedChangeSummary` is exported via `index.ts`'s
  existing `export *` (no edit needed) and is intentionally absent from
  `browser.ts` (not added — matches that file's Node-fs-only exclusion).

## 2. Server: additive archived-change summaries on `/api/overview`

- [x] 2.1 `packages/server/src/rest.ts`: `OverviewResponse` gains
  `archivedChangeSummaries: OverviewArchivedChangeSummary[]`;
  `archivedChanges: string[]` left exactly as-is. `handleOverviewRequest`
  populates the new field via `Promise.all` over
  `workspace.archivedChanges`, zipping each `name` with
  `getArchivedChangeSummary(cwd, name)`.
- [x] 2.2 `server.test.ts`: extended the existing archived-changes
  overview test with a `tasks.md` (1 done/1 not done) and assertions on
  `archivedChangeSummaries` (correct name/completedTasks/totalTasks,
  `lastModified` is a string); `archivedChanges` assertion unchanged.

## 3. Webui: shared filter, wire real components into Overview

- [x] 3.1 `packages/webui/src/components/change-filter.ts` (new):
  `STATE_LABEL` (moved from `ChangesList.tsx`), `filterChanges(changes,
  query)` — case-insensitive match against `name` or the state's human
  label; empty query returns all.
- [x] 3.2 `change-filter.test.ts` (new): name match, status-label match,
  case-insensitive, empty query returns all, no matches returns `[]`.
  4/4 passing.
- [x] 3.3 `ChangesList.tsx`: imports `STATE_LABEL`/`filterChanges` from
  `./change-filter.js` instead of a private copy; added the same
  `useState`/`useMemo` search-box pattern `ArchiveList` already has
  (`<input type="search" aria-label="Search changes">`).
- [x] 3.4 `ArchiveList.tsx`: replaced its inline name-only `.filter(...)`
  with the shared `filterChanges` (still sorts by `lastModified`
  afterward, unchanged).
- [x] 3.5 `ChangesList.test.tsx` / `ArchiveList.test.tsx`: added search
  tests (filters by name, filters by status label); existing tests still
  pass. 5/5 and 5/5 passing respectively.
- [x] 3.6 New `packages/webui/src/overview-mapping.ts` (side-effect-free —
  `standalone-entry.tsx` renders to `document.getElementById("root")` at
  import time, so this logic can't live there and still be unit-testable):
  `toChangeState(status: string): ChangeState` (validates against the
  known union, falls back to `"in-progress"` + `console.warn`),
  `toChangeSummary(...)`.
- [x] 3.7 `overview-mapping.test.ts` (new): each known `ChangeState`
  value passes through unchanged; an unrecognized status falls back to
  `"in-progress"` and warns exactly once; `toChangeSummary` maps fields
  correctly. 3/3 passing.
- [x] 3.8 `standalone-entry.tsx`: `OverviewArchivedChangeSummary` type
  added. Replaced the active-changes `<table>` with `<ChangesList>`, fed
  by `overview.changes` mapped through `toChangeState`/`toChangeSummary`.
  Added a new "Archive" block to the Overview tab (none existed before)
  using `<ArchiveList>`, fed by `overview.archivedChangeSummaries` (state
  hardcoded to `"archived"`). The four existing `overview.archivedChanges`
  (plain-name) dropdown consumers were not touched.
- [x] 3.9 Confirmed no pre-existing unit test file covered
  `standalone-entry.tsx` rendering before this change. Ran
  `packages/server/e2e/standalone.spec.ts` (real Chromium via Playwright)
  against the new markup: passes, including the axe-core accessibility
  check (no serious/critical violations) — 1/1 passing.

## 4. Verification, versioning, and smoke test

- [x] 4.1 `npm run typecheck && npm run lint && npm run test` — run
  workspace-wide after `git add` of all new/changed files. Typecheck and
  lint (including `lint:english`) clean across all packages. Tests:
  511 passing across core/cli/extension/webui/server, with two
  pre-existing, unrelated intermittent failures in
  `packages/server/src/server.test.ts`'s WebSocket suite (`EBUSY`/
  `ENOTEMPTY` on Windows temp-directory cleanup racing a still-open file
  handle — confirmed by re-running: a different WebSocket test fails each
  time, never the overview-related test, and neither touches this
  change's code paths).
- [x] 4.2 Added `.changeset/changes-overview-search.md` — minor bump for
  `@openspec-ui/core`, `@openspec-ui/server`, `@openspec-ui/webui`;
  verified with `npx changeset status`. (`npx changeset version`, which
  actually applies the bump, is a separate, later step per
  `.changeset/README.md`'s workflow, not part of an individual change.)
- [x] 4.3 Manual smoke test: started the real standalone server
  (`packages/server/src/cli.ts`) against this repository's own real
  `openspec/` directory (77 archived changes) and called `/api/overview`
  with the server's own access token. Confirmed `archivedChangeSummaries`
  contains real per-change `completedTasks`/`totalTasks`/`lastModified`
  for all 77 archived changes, and `archivedChanges` (the field the four
  unrelated pickers depend on) is unchanged — still the same plain name
  list. Browser-level rendering/search/accessibility covered by the
  Playwright e2e run in 3.9.
- [x] 4.4 `openspec change validate --strict changes-overview-search` —
  "Change "changes-overview-search" is valid".
