The schedule promised a run at the next open. It fires only after a
click, loses an archived change silently, and forgets the path it was
given.

## 1. One firing function in core

- [x] 1.1 `packages/core/src/scheduled-runs.ts`: `readSchedule` reports
  an entry whose change is archived as dropped with reason `archived`,
  distinct from `deleted`. The prefix match in `stillExists` moves to
  that case. Done: `stillExists` became `locateChange`, returning
  `active` / `archived` / `gone`; `dropped` now carries
  `{ entry, reason }` with a third reason `unreadable-time` for the time
  nothing can compare against, and `describeDrop` writes the sentence
  for each, once.
- [x] 1.2 A function that takes entries, known changes and the clock and
  returns: the remaining entries to write back, the entry to start with
  its lateness, the dropped entries with reasons, and the count still
  waiting. `describeLateness` and the "more scheduled run(s) are still
  waiting" sentence are produced here, once. Done:
  `planScheduleFiring`, which also returns `afterDrops` — what to write
  once the drops are applied and before the run is opened, because an
  entry is consumed only once its run has opened.
- [x] 1.3 Both hosts call it and perform effects only: write the file
  after the run is opened, open the run, print or show the sentences.
  Delete the duplicated loop from `scheduled-run-watcher.ts` and from
  `standalone-entry.tsx`. Done: the shell's half moved out of the
  bootstrap file into `packages/webui/src/scheduled-run-firing.ts`
  (`fireDueSchedule`), which takes the effects as a host object and is
  unit tested; `standalone-entry.tsx` now supplies those effects and
  nothing else.
- [x] 1.4 An in-flight guard in each host, so a pass that outlasts the
  tick is not overlapped by the next. Extension: a closure flag in
  `watchScheduledRuns`, so `checkScheduleOnce` stays directly testable.
  Shell: a `useRef` around `fireDueRuns`.

## 2. Opening the application is enough

- [x] 2.1 `standalone-entry.tsx`: once the workspace root is known on
  open, load the overview. The blur and the button keep working as
  reloads. The blur now reloads only when the field names a root other
  than the one the overview was read for — otherwise every open started
  a second reading of the same workspace while the first was still
  running, two `openspec` CLI processes for one answer, which left the
  browser suite's temp workspace locked at teardown.
- [x] 2.2 The browser test "when the time passed with nothing open"
  navigates to the page and does nothing else. If it needs to fill the
  root field, the promise is not met.

## 3. The stored path is the path taken

- [x] 3.1 A due run opens the dialog with `entry.path` and starts it,
  in both hosts. Where the path is no longer offered for that change,
  the dialog opens for a choice and says the configured paths changed
  (`describePathNoLongerOffered`, in core, so both hosts say it the same
  way). The extension carries the path to the webview as
  `AiPanelContext.runPath`, which `extension-entry.tsx` takes as soon as
  the dialog mounts.
- [x] 3.2 The browser test "starts by itself when its time comes" asserts
  that the run started on the scheduled path, not only that a note
  appeared. It asserts the "Run a Command" surface is pointed at the
  scheduled change and no dialog is waiting — a `chain` would have
  mounted the chain panel instead, so the two paths are distinguished.

## 4. Consumed only once opened

- [x] 4.1 The shell resolves the dispatch before removing the entry, and
  a failure there is reported as "the scheduled run could not be opened:
  ..." with the entry left in the file. "Reading the schedule failed"
  now belongs to the read alone.
- [x] 4.2 The extension does the same around `resolveHarnessConfig` and
  `revealAiPanel`. Drops are still written straight away — a drop cannot
  fail to be carried out, and making it wait on a run that can would
  lose it.

## 5. The editor points at what it loaded

- [x] 5.1 Firing loads the scheduled change into the editor by the same
  path a manual selection takes. With unsaved edits on another change,
  the dialog opens over a message and the editor is not switched. Which
  change has unsaved edits is tracked in a ref, because the firing
  effect's closure belongs to the render that created it.
- [x] 5.2 A manual start clears the lateness note. `runNote` is set by a
  schedule and cleared by any start or dismissal — `startChosenRun`,
  `handleRunWithHarness`, `scheduleRun` and the dialog's Cancel. Checked
  by the browser test in 3.2, which opens the dialog by hand after a
  schedule fired and asserts no note came with it.

## 6. Announced

- [x] 6.1 `RunDialog` carries `role="dialog"`, an accessible name, and
  takes focus when it opens by itself. Only then: taking focus from a
  person who pressed the button would move them away from what they were
  reading.
- [x] 6.2 The schedule's messages render in a `role="status"` region
  present in every tab of the shell (`data-testid="schedule-status"`,
  above the tab strip). Kept apart from `runHarnessMessage`, which
  belongs to the change editor.
  A second live region in the shell made `getByRole("status")`
  ambiguous, and the rollback assertion in
  `e2e/lifecycle-recovery-and-rollback.spec.ts` failed on Playwright's
  strict mode — caught by running the whole browser suite, not the
  three specs this change touches. `ProcessesView`'s message now
  carries `data-testid="processes-message"` and that assertion names
  it. An assertion that means one of several regions has to say
  which.
- [x] 6.3 `checkScheduleTime` is reached before `toISOString()` can
  throw, so "That is not a time this can read" is shown rather than an
  uncaught `RangeError`. The premise was half right: the ordering was
  wrong, but the branch was unreachable for a second reason the item
  does not mention — a `datetime-local` input blanks a value it cannot
  parse, and the schedule buttons were disabled on an empty value, so
  nothing unreadable could ever arrive. The buttons are no longer
  disabled; a control that does nothing and says nothing is the defect
  this dialog exists to remove, and a browser without `datetime-local`
  renders a text box that hands the handler anything at all.

## 7. Tests

- [x] 7.1 Core: an archived change is dropped as archived; a deleted one
  as deleted; a due run behind an archived entry starts on the same
  reading. `packages/core/src/scheduled-runs.test.ts`.
- [x] 7.2 Core: the firing function's returned list excludes the started
  entry and keeps the waiting ones, and `afterDrops` still holds the
  starting entry.
- [x] 7.3 Extension: `checkScheduleOnce` with an archived change writes
  the file without the entry and prints the reason; with a failing
  `resolveHarnessConfig`, leaves the file as it was. Also: the path the
  entry named reaches `revealAiPanel`, and a path the plan no longer
  offers reaches it as a note instead.
- [x] 7.4 Webui: `fireDueRuns` with a failing dispatch leaves the entry
  and shows the opening failure. Tested against
  `packages/webui/src/scheduled-run-firing.ts`, which is where that loop
  now lives — `standalone-entry.tsx` is a bootstrap script and is not
  unit tested, which is how the defect got in. "A manual start clears
  the note" is asserted in the browser suite instead, under 5.2: it is
  wiring in the bootstrap file with no unit seam.
- [x] 7.5 Browser: both schedule cases as rewritten in 2.2 and 3.2.
  `npm run test:browser --workspace @openspec-ui/server -- scheduled-run`
  — 2 passed (2.7 min with `waiting-on-inbox` and `standalone` in the
  same run, all 4 green).

## 8. Verification

- [x] 8.1 `openspec validate --strict --changes`. 9 passed, 0 failed.
- [x] 8.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Exit 0. Typecheck and lint clean across all five workspaces;
  tests: `@openspec-ui/cli` 48 in 4 files, `@openspec-ui/core` 851 in 61
  files, `openspec-ui-vscode` 320 in 24 files, `@openspec-ui/server` 79
  in 4 files, `@openspec-ui/webui` 356 in 42 files — 1654 in 135 files,
  0 failed. The browser suite is separate (7.5).
- [x] 8.3 Version bump via `npx changeset` for core, webui, server and
  the extension: `.changeset/quiet-schedules-keep-promises.md` —
  `@openspec-ui/core` minor, `@openspec-ui/webui` minor,
  `@openspec-ui/server` patch, `openspec-ui-vscode` minor.
- [x] 8.4 `HARNESS.md`, the scheduling section: what an archived change
  does to a schedule, and that opening the application is enough.
- [x] 8.5 **Delegated to copilot-cli**: in the VS Code integration suite,
  against a real workspace, write a schedule entry already due, archive
  the change it names, run `checkScheduleOnce`, and assert the output
  channel line says the entry was dropped as archived. Then a second
  entry naming a path asserts `revealAiPanel` received that path and no
  further input was needed. Evidence: "scheduled runs drop archived
  changes and preserve the scheduled path" passed in `npm run
  test:integration --workspace openspec-ui-vscode` on 2026-09-11 (17
  passing); it covers both cases in one real Extension Host test.
