The tempting fix is one line — clear `progress` in `finish()` — and it
deletes the only record this project keeps of a reclaimed workspace
lease. Every task below is written so that the display stops lying
without any evidence being thrown away to achieve it.

## 1. Stop writing a state where progress belongs

- [x] 1.1 Remove `report("Running")` from
  `packages/extension/src/implementation-sessions.ts`. It fires once
  before `options.execute()` and is never updated, so while the process
  runs it repeats `state`, and after it finishes it is false.
- [x] 1.2 Confirm nothing else reports a state-shaped string as progress:
  grep the reporters, not just this one call.
  Checked 2026-09-06. One other reporter writes a fixed string:
  `report("Working in VS Code Agent mode")` in the same file. It is kept —
  it says *where* the work is happening, which `state` does not say, and
  the surface change in section 2 is what stops it outliving the run.
- [x] 1.3 Leave the two `describeWorkspaceLeaseReclamation` writes in
  `process-scheduler.ts` alone. They are the reason this change does not
  clear the field, and moving them is a separate proposal.

## 2. A terminal row stops showing a live field

- [x] 2.1 In `packages/extension/src/tree/processes-tree.ts`, drop
  `process.progress` from the joined description when the state is
  terminal. Keep `state` and everything else in place — the row must
  still say what happened.
- [x] 2.2 Keep `progress` in the tooltip fallback chain, so the
  lease-reclamation note stays reachable on a finished run. That is the
  half of this that makes clearing the field unnecessary.
- [x] 2.3 A running process still shows it. The defect is a live field
  outliving the run, not the field itself.

## 3. The records already written

- [x] 3.1 On journal load, drop `progress` from a record whose state is
  terminal **and** whose value is exactly the obsolete `"Running"`
  marker. Nothing else: any other string is a statement about what
  happened and is preserved verbatim.
- [x] 3.2 No journal version bump. The version is already 3 and this is a
  value-level correction, not a shape change; bumping would make every
  older reader fail closed over a string.
- [x] 3.3 Apply it on load rather than on save, so a journal that is only
  ever read is corrected too.

## 4. Tests

- [x] 4.1 `process-scheduler.test.ts`: a process that reports progress and
  then finishes keeps its recorded value — this change does not clear the
  field, and a test must hold that line against the tidier-looking fix.
  Already held by an existing test: `process-scheduler.test.ts`'s lease
  reclamation case asserts `state === "completed"` and
  `progress` containing "Reclaimed" on the same record. That is precisely
  the line a clear-in-`finish()` fix would cross, so no new test was
  added — the guard was already there and is now load-bearing.
- [x] 4.2 `implementation-sessions.test.ts`: a completed session records
  no `progress`.
  Written as "no state-shaped progress" rather than "no progress": the
  first draft asserted `toBeUndefined()` and failed, because the session
  still records "Working in VS Code Agent mode". The test was wrong, not
  the code, and it now asserts both halves — the marker is gone, the
  informative note survives.
- [x] 4.3 `workbench-run-journal.test.ts`: a persisted terminal record
  carrying `"Running"` loads without it; one carrying the
  lease-reclamation sentence loads with it; a *running* record carrying
  `"Running"` keeps it, since only terminal records are corrected.
- [x] 4.4 A test over the tree description: terminal row has no progress
  segment, running row does, and the tooltip has it either way.

## 5. Verification

- [x] 5.1 `openspec change validate --strict finished-process-reports-no-progress`.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  All three pass, 2026-09-06. `lint` reports one pre-existing warning in
  `packages/core/src/agents/shared.ts` (`killTimer` unused), untouched
  here. Removing `report("Running")` left `report` unused in the
  destructured execution context, which lint caught; the parameter is
  dropped rather than renamed, since nothing there reports any more.
- [x] 5.3 Re-read this workspace's own journal after the change and count
  the records that still show a terminal state beside `"Running"`. It was
  45 of 100 carrying a progress value, 38 of them that marker.
  Read back through the real loader, against this workspace's own
  journal: **45 terminal records carried a progress value before, 38 of
  them the marker; now 7 carry one and none is the marker.** The seven
  kept are exactly the informative ones — two workspace-lease
  reclamations and four "Working in VS Code Agent mode" — which the row
  now hides and the tooltip still shows.
- [x] 5.4 Version bump via `npx changeset`: `core` changes how a journal
  loads and the extension changes what it displays.
  `@openspec-ui/core` patch (journal load) and `openspec-ui-vscode` patch
  (what the tree shows).
- [ ] 5.5 **Human-only**: reload the VS Code window and confirm the
  Processes view shows finished runs without "Running" beside their
  state, that a run still going still shows its progress, and that
  hovering a run that reclaimed the lease still shows that sentence.
