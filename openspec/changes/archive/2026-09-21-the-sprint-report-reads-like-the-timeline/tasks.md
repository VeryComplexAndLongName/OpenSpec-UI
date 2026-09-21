Reported by the owner on 2026-09-21: the Sprint Report does not generate.
The machine sits at 100%, nothing happens, and the button can be pressed
again.

## 1. The report reads like the timeline

- [x] 1.1 `buildSprintReport` reads timelines through `getChangeTimelines`:
  in batches of `TIMELINE_BATCH`, with the archive's dates read once.
- [x] 1.2 `readChangeAuthorships` reads every change's authorship,
  active and archived, from one `git log --name-only --full-history
  --no-renames` over `openspec/changes`. It returns `undefined` when git
  cannot be asked, and the report then asks per change, in batches.
- [x] 1.3 The report discovers no workspace: a change's directory is
  known from its name.
- [x] 1.4 `readProposalCreatedDates` dates every proposal from one
  `git log --full-history -M --diff-filter=AR --name-status` over
  `openspec/changes`, following moves itself. `getChangeTimelines` passes
  it to each timeline when it reads more than one; a change it does not
  know is asked with `--follow`, as before.

## 2. The tab opens from the click

- [x] 2.1 The standalone opens the report's tab before the request and
  shows `renderSprintReportNotice`: how many changes it is reading.
- [x] 2.2 The same tab becomes the report, or shows the failure.
- [x] 2.3 The VS Code command shows a progress notification while it
  reads.

## 3. Checks

- [x] 3.1 Measured before and after on this repository, 2026-09-21,
  archived changes only. Before: 20 in 4.6 s, 100 in 32 s, all 296 in
  109 s of wall time and 65 s of processor. After: 66 (the last week) in
  6.8 s, all 296 in 26 s and 13 s. One read of every authorship is 0.3 s
  and of every proposal's first commit 0.6 s. Both checked against the
  per-change calls over every change here: authorship differs for one
  change, by a real commit the per-change call had hidden; the dates do
  not differ at all.
- [x] 3.2 Tests: the batched authorship read against the per-change call
  (active, archived, a move, a file that belongs to no change, a nested
  workspace, no git), the batched proposal dates against `--follow` (an
  archived change, a change renamed before archiving, a nested workspace,
  no git), the notice page, and a browser spec that holds the
  request and sees the waiting tab first. The spec fails on `main`'s
  click handler.
- [x] 3.3 `npm run typecheck && npm run lint && npm run test` at the
  root, after `git add`, run unpiped. typecheck and lint pass. Tests:
  cli 175, core 1741 and 20, extension 474, server 112, webui 639 of
  640. The one failure is `packages/webui/scripts/build-metro-icons.test.mjs`,
  which fails on Windows for its line endings and fails the same way on
  untouched `main`.
- [x] 3.4 The whole standalone browser suite passes: 27 of 27, run after
  the last code change. The new `sprint-report.spec.ts` fails on `main`'s
  click handler: the tab never opens and the test times out waiting for
  it.
- [x] 3.5 A changeset: core, webui, server and the extension change.
- [x] 3.6 `openspec validate the-sprint-report-reads-like-the-timeline --strict`.
- [x] 3.7 **Human-only.** In the owner's standalone, a report over a real
  selection opens its tab at once and becomes the report. **Done by
  Claude on 2026-09-21 at the owner's request, for the owner to look at in
  turn:** this worktree's standalone over the owner's repository, in
  Chromium. The whole archive (295 changes): the tab opened in 0.14 s
  saying "Reading 295 changes", and the report arrived after 40 s (103 s
  before the dates were batched). The last week (66 changes): the tab in
  0.24 s, the report after 26 s. Slower than the bare measurement in 3.1,
  because the page reads its own views at the same time.
