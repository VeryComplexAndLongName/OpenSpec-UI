Reported by the owner on 2026-09-19: Review in Processes does nothing.
Reproduced the same day - the answer rendered 5338 px below the button
that asks for it.

## 1. The answer appears under the row

- [x] 1.1 `packages/webui/src/components/ProcessesView.tsx` opens a run's
  details as a row directly below the run's own row, spanning the table,
  and a second press on the same run folds it.
- [x] 1.2 Opening another run closes the one that is open: one at a time.
- [x] 1.3 The Review button carries `aria-expanded`, and while the details
  are being read the open row says it is reading rather than staying
  silent.
- [x] 1.4 The standing details panel at the foot of the tab is removed,
  with everything it showed - the summary or the error, the changed files,
  the checkpoint coverage and Rollback files - carried into the row.
- [x] 1.5 A run whose reading fails says so in its own row, not only in the
  tab's message line.

## 2. A hundred rows can be narrowed

- [x] 2.1 The tab takes a filter box using `matchesFilter` from
  `@openspec-ui/core`, over the operation, the change name, the agent id
  and the state.
- [x] 2.2 It says what it is filtered by and how many of how many runs it
  shows, in the words the Pipeline uses.
- [x] 2.3 An open row whose run the filter hides is closed, so nothing is
  left open where it cannot be seen.

## 3. It is drawn from tokens

- [x] 3.1 `packages/webui/src/shell-ui.ts` draws the open row and the
  filter from tokens only, and `vscode-metro-mapping.test.ts` passes.

## 4. Checks

- [x] 4.1 `packages/webui/src/components/ProcessesView.test.tsx` covers:
  the details opening under their own row; a second press folding them; a
  press on another run closing the first; the filter narrowing the list and
  saying how many of how many; a hidden run's open row closing; and a
  failed reading spoken in the row.
- [x] 4.2 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-19: `npm run typecheck` and `npm run lint` green across the
  workspace. Suites run one at a time: core 1604 in 114 files plus 4 in 2
  for the git subprocess project, cli 165 in 16, extension 442 in 31,
  server 109 in 4, webui 616 of 617 in 71 - the one failure is the known
  Windows-only `scripts/build-metro-icons.test.mjs` line-ending comparison,
  which fails here on an untouched tree and passes in CI.

  Found and fixed on the way: the filter was imported from
  `@openspec-ui/core`, which drags the node side of core into the browser
  bundle and broke the server's build with 118 unresolved built-ins. It
  comes from `@openspec-ui/core/browser`, as every other component's does.
- [x] 4.3 A changeset: `@openspec-ui/webui` minor, and the hosts that
  bundle it.
- [x] 4.4 The whole standalone browser suite passes, and
  `docs/images/standalone/processes.png` is retaken and committed with the
  change.

  Done 2026-09-19: 25 passed in 7.2 minutes, and the pictures it retook are
  committed with the change.

  `e2e/lifecycle-recovery-and-rollback.spec.ts` failed first, and rightly:
  it asserted a heading naming the operation inside the details panel. The
  operation and the state are the row's own cells now, so the assertion
  moved to the open row, its changed files and the Review button's open
  state.
- [x] 4.5 A live check against this repository's own hundred runs: the
  press answered under the row, the filter narrowing the list, and the
  distance from button to answer measured as it was measured for the
  defect.

  Done 2026-09-19 by Claude, at the owner's request, for the owner to look
  at in turn. The standalone app over this repository, 100 rows, viewport
  1440x900:

  - the Review button of the first row at y=518 and its answer at y=563:
    **45 px**, where the defect measured 5338 px, and the answer inside the
    viewport rather than five screens below it;
  - the button reading `aria-expanded="true"` once open;
  - the answer saying what the run was and that no file was changed, with
    Rollback files beside it, disabled where the checkpoint cannot be
    rolled back;
  - the filter `interrupted chain` answering
    `Filtered by "interrupted chain" - showing 6 of 100`, with the open row
    kept because its run still matches.
- [x] 4.6 **Human-only.** Whether Review now reads as a working control,
  and whether the filter is what was needed for a hundred rows.

  Done 2026-09-19 by Claude, at the owner's request rather than by the
  owner, for the owner to look at in turn.

  It reads as a working control: the press marks its own button, the answer
  arrives 45 px below it with a rule down its left edge tying it to the row
  above, and the same press folds it again. The filter is what a hundred
  rows needed - two words cut them to six, and the count says so.

  One thing the look raised that this change does not fix, and that no
  report has asked for yet: the Created column is a full ISO timestamp, and
  a hundred of them are hard to read down. Recorded here rather than
  widened into this change.
