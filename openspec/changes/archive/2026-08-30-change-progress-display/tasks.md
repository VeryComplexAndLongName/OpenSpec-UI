## 1. Shared formatting helper

- [x] 1.1 `packages/webui/src/components/task-progress.ts` (new):
  `taskCompletionPercent(completedTasks, totalTasks): number | null`
  (`null` when `totalTasks <= 0`); `formatTaskProgress(completedTasks,
  totalTasks): string` (`"C/T"` when no percent, `"C/T (P%)"` otherwise).
- [x] 1.2 `task-progress.test.ts` (new): zero total → plain fraction, no
  percent; a normal fraction rounds correctly (1/3 → 33%); zero
  completed of a positive total → "(0%)" still shown; 100% case. 6/6
  passing.

## 2. Wire into ChangesList/ArchiveList

- [x] 2.1 `ChangesList.tsx`: uses `formatTaskProgress` for the progress
  span; renders `lastModified` identically to `ArchiveList.tsx`.
- [x] 2.2 `ArchiveList.tsx`: added a `.openspec-change-progress` span
  using `formatTaskProgress`.
- [x] 2.3 `ChangesList.test.tsx`: extended assertions to check the
  percentage text for each of the three existing fixture changes
  ("20/20 (100%)", "4/17 (24%)", "0/16 (0%)"), plus a new `lastModified`
  rendering case. 6/6 passing.
- [x] 2.4 `ArchiveList.test.tsx`: added a partially-complete fixture
  entry and an assertion for "4/17 (24%)". 6/6 passing.

## 3. Spec, versioning, verification

- [x] 3.1 `openspec/changes/change-progress-display/specs/shared-ui/spec.md`:
  `ADDED Requirements` for task-completion percentage + `lastModified`
  in both lists.
- [x] 3.2 `npm run typecheck && npm run lint && npm run test`
  workspace-wide (after `git add`): typecheck and lint (including
  `lint:english`) clean across all packages. Tests: 512 passing across
  core/cli/extension/webui, plus the Playwright e2e suite
  (`standalone.spec.ts`, unmodified, still passing). `packages/server`'s
  vitest suite: 48/49, with the same pre-existing, unrelated Windows
  temp-directory cleanup race in its WebSocket tests documented against
  the two previous changes — this change touches no server code at all.
- [x] 3.3 Added `.changeset/change-progress-display.md` — minor bump for
  `@openspec-ui/webui`; verified with `npx changeset status`.
- [x] 3.4 Manual smoke test: ran the real standalone server against this
  repository's own live data with a real Chromium instance (Playwright).
  Confirmed the rendered Changes list text matches a real change (this
  very change, `change-progress-display`): "In progress 0/11 (0%)
  2026-08-30T06:59:33.297Z" — percentage and last-modified date both
  render correctly from real data.
- [x] 3.5 `openspec change validate --strict change-progress-display` —
  "Change "change-progress-display" is valid".
