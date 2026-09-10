The schedule promised a run at the next open. It fires only after a
click, loses an archived change silently, and forgets the path it was
given.

## 1. One firing function in core

- [ ] 1.1 `packages/core/src/scheduled-runs.ts`: `readSchedule` reports
  an entry whose change is archived as dropped with reason `archived`,
  distinct from `deleted`. The prefix match in `stillExists` moves to
  that case.
- [ ] 1.2 A function that takes entries, known changes and the clock and
  returns: the remaining entries to write back, the entry to start with
  its lateness, the dropped entries with reasons, and the count still
  waiting. `describeLateness` and the "more scheduled run(s) are still
  waiting" sentence are produced here, once.
- [ ] 1.3 Both hosts call it and perform effects only: write the file
  after the run is opened, open the run, print or show the sentences.
  Delete the duplicated loop from `scheduled-run-watcher.ts` and from
  `standalone-entry.tsx`.
- [ ] 1.4 An in-flight guard in each host, so a pass that outlasts the
  tick is not overlapped by the next.

## 2. Opening the application is enough

- [ ] 2.1 `standalone-entry.tsx`: once the workspace root is known on
  open, load the overview. The blur and the button keep working as
  reloads.
- [ ] 2.2 The browser test "when the time passed with nothing open"
  navigates to the page and does nothing else. If it needs to fill the
  root field, the promise is not met.

## 3. The stored path is the path taken

- [ ] 3.1 A due run opens the dialog with `entry.path` and starts it,
  in both hosts. Where the path is no longer offered for that change,
  the dialog opens for a choice and says the configured paths changed.
- [ ] 3.2 The browser test "starts by itself when its time comes" asserts
  that the run started on the scheduled path, not only that a note
  appeared.

## 4. Consumed only once opened

- [ ] 4.1 The shell resolves the dispatch before removing the entry, and
  a failure there is reported as "the scheduled run could not be opened:
  ..." with the entry left in the file.
- [ ] 4.2 The extension does the same around `resolveHarnessConfig` and
  `revealAiPanel`.

## 5. The editor points at what it loaded

- [ ] 5.1 Firing loads the scheduled change into the editor by the same
  path a manual selection takes. With unsaved edits on another change,
  the dialog opens over a message and the editor is not switched.
- [ ] 5.2 A manual start clears the lateness note. `runNote` is set by a
  schedule and cleared by any start or dismissal.

## 6. Announced

- [ ] 6.1 `RunDialog` carries `role="dialog"`, an accessible name, and
  takes focus when it opens by itself.
- [ ] 6.2 The schedule's messages render in a `role="status"` region
  present in every tab of the shell.
- [ ] 6.3 `checkScheduleTime` is reached before `toISOString()` can
  throw, so "That is not a time this can read" is shown rather than an
  uncaught `RangeError`.

## 7. Tests

- [ ] 7.1 Core: an archived change is dropped as archived; a deleted one
  as deleted; a due run behind an archived entry starts on the same
  reading.
- [ ] 7.2 Core: the firing function's returned list excludes the started
  entry and keeps the waiting ones.
- [ ] 7.3 Extension: `checkScheduleOnce` with an archived change writes
  the file without the entry and prints the reason; with a failing
  `resolveHarnessConfig`, leaves the file as it was.
- [ ] 7.4 Webui: `fireDueRuns` with a failing dispatch leaves the entry
  and shows the opening failure; a manual start clears the note.
- [ ] 7.5 Browser: both schedule cases as rewritten in 2.2 and 3.2.

## 8. Verification

- [ ] 8.1 `openspec validate --strict --changes`.
- [ ] 8.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run.
- [ ] 8.3 Version bump via `npx changeset` for core, webui, server and
  the extension.
- [ ] 8.4 `HARNESS.md`, the scheduling section: what an archived change
  does to a schedule, and that opening the application is enough.
- [ ] 8.5 **Human-only**: in VS Code, schedule a run two minutes ahead,
  archive the change, and confirm the output channel says it was dropped
  as archived. Then schedule another and confirm it starts on the chosen
  path without a further click.
