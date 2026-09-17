The fourth step of ADR 0033's delivery order: the Timeline's one-change
screen, as the mockup's "Timeline: one change" artboard draws it
(<https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L>).

## 1. The moments

- [x] 1.1 A new `packages/webui/src/timeline-moments.ts` exports
  `timelineMoments(timeline)`: the proposed moment, one moment per distinct
  task `date` instant with its tasks in `tasks.md` order, and the archived
  moment, oldest first. A fact or task with no date is not a moment.
- [x] 1.2 It exports `taskNumberAndTitle(text)`: a leading dotted number and
  the rest, or no number.
- [x] 1.3 It exports `openTasks(timeline, staleThresholdDays, now)`, each
  with whether it is stale by core's `isTaskStale`, and
  `undatedDoneTasks(timeline)`.
- [x] 1.4 It exports `timelineTile(timeline)`: done, total, and the
  span from proposed to archived, or to last worked while active, as
  "10 h 07 min", "3 d 4 h" or "45 min"; no span without both dates.
- [x] 1.5 It exports `timelineDates(timeline, timeZone?)`: the four rows (no
  Archived row for an active change), each with its moment as read and its
  source as words ("from a git commit", "from git blame on
  tasks.md", "from the audit log", "from the archive folder's name", "could
  not be read", "not recorded").
- [x] 1.6 It exports `formatMoment(iso, timeZone?)`: "Sun 13 Sep, 18:40",
  in the given zone or the viewer's, from `en-US` parts put in that order
  (`en-GB`'s short month reads "Sept"); and `formatMomentDay(day)`, "Mon 14
  Sep", for a date read from an archive folder's name, which has no time. An
  archived moment read that way shows its day and is placed at that day's
  end, after the day's ticks.
- [x] 1.7 `packages/webui/src/timeline-moments.test.ts` covers each export:
  grouping on the instant and not the day, ordering, a change with no
  dates, an active change's span, each source word, and a fixed zone.
- [x] 1.8 `packages/core/src/task-checklist.ts`: a `TaskChecklistItem`
  carries `continued`, the indented lines straight after its checkbox line,
  up to a blank line, a list item or a heading, joined with spaces; absent
  when the task fits its line. `task-checklist.test.ts` covers a wrapped
  task, a record after a blank line, a nested list item, a tab indent,
  CRLF, and a heading ending a task.
- [x] 1.9 `timeline-moments.ts` exports `taskSentence(task)`: the text and
  its `continued`, without `**` and backquote marks. The view draws the
  title from it on one line, with the whole sentence as its `title`.

## 2. The view

- [x] 2.1 `packages/webui/src/components/ChangeTimelineView.tsx` draws two
  columns: the "Tasks over time" panel, headed "times are local", with the
  moments on a rail — Proposed and Archived as badges with what happened,
  a single task as its number and title, a group as "N tasks ticked in one
  commit" with its first three and "and N more", which a person can open
  whole and close; beside it a Tasks tile and a Dates panel, and, where any
  moment holds more than one task, the note that a squashed commit gives
  its tasks one time.
- [x] 2.2 Below the columns: "Still open", open tasks by number with a
  Stale badge past the threshold; "Done, date unknown"; and "Documents",
  the proposal, design and each spec, each in a closed `<details>`. A
  section with nothing to list is not drawn.
- [x] 2.3 The view takes an optional `heading`; given, it draws the
  change's name and whether it is archived above the columns.
- [x] 2.4 `packages/webui/src/components/ChangeTimelineView.test.tsx`
  asserts the moments in order, a group's count, first three and "and N
  more", opening a group whole, the tile's figures, the Dates panel's
  source words, the open and undated lists, the documents closed, the
  heading only when given, and stale marking following the threshold.

## 3. The tab

- [x] 3.1 The Timeline tab's modes in `packages/webui/src/standalone-entry.tsx`
  read "One change", "Compare changes" and "Sprint report", drawn as one
  segmented control.
- [x] 3.2 Choosing a change loads its timeline; the Load timeline button
  goes. An option reads the change's name, and "· archived" for an archived
  one, without its date prefix. A failed load says so beside the picker.
  Choosing again puts the change shown away at once.
- [x] 3.3 "Stale after N days" sits at the toolbar's right, and changing it
  redraws the view without reading again.
- [x] 3.4 While a timeline is shown, the page head reads "Timeline" above
  the change's name, and "Archived" or "Active" with "each task placed when
  git shows it was ticked" under it.
- [x] 3.5 `shellThemeCss` in `packages/webui/src/shell-ui.ts` draws the
  toolbar, the segmented control, the two columns, the rail and its dots,
  the badges, the tile, the Dates panel and the lists below, from tokens
  only, in both themes, and one column under 760 pixels. The old
  `.openspec-timeline-*` rules the view no longer uses go.
- [x] 3.6 Tests that loaded a timeline by its button choose the change
  instead.

## 4. The editor's panel

- [x] 4.1 `packages/webui/src/timeline-entry.tsx` draws `ChangeTimelineView`
  with its heading.

## 5. The browser suite

- [x] 5.1 `packages/server/e2e/frame-screenshots.spec.ts` builds a fixture
  whose change has a history — a proposal commit, a commit ticking several
  tasks, a commit ticking one, and the archive commit, each at a set time —
  chooses it in the Timeline tab, and writes `timeline-change-light.png` and
  `timeline-change-dark.png` at 1280 pixels.

  Done: `fixtures/create-timeline-workspace.ts` commits the change's
  proposal at 15:40 UTC, five tasks at 20:16, one at 21:13, one at 01:40 and
  the archive at 01:47, and the test runs in `Europe/Moscow`, the zone the
  artboard's times are in. It asserts, before taking the pictures, that the
  page head names the change, the tile reads "7 / 7" and "proposed to
  archived in 10 h 07 min", the group reads "5 tasks ticked in one commit",
  the first moment reads "Sun 13 Sep, 18:40", and the proposed date is "from
  a git commit". Compared with the artboard in both themes, the first
  picture showed Metro drawing the picker as wide as the toolbar, which put
  "Stale after" on a second row; the picker is now 360 pixels, and the
  toolbar is one row as drawn.

## 6. Checks

- [x] 6.1 `openspec validate the-change-timeline-looks-like-the-mockup
  --strict` passes.
- [x] 6.2 `npm run verify` passes, run unpiped. Record each package's count.

  Done on 2026-09-17, run again after 6.6's fixes: typecheck and lint pass
  in every package. Tests: `@openspec-ui/cli` 161 in 16 files;
  `@openspec-ui/core` 1492 in 106 files and 4 in 2 git-subprocess files;
  `openspec-ui-vscode` 397 in 30 files; `@openspec-ui/server` 103 in 4
  files; `@openspec-ui/webui` 588 of 589 in 69 files. The one failure is
  `scripts/build-metro-icons.test.mjs`, which compares the generated icon
  stylesheet with the checked-out one and fails on Windows only, where the
  checkout has CRLF line ends; it fails the same way on `main`, and this
  change does not touch it.

- [x] 6.3 A changeset, written with the implementation: `@openspec-ui/webui`
  minor, `@openspec-ui/core` minor for 1.8, `openspec-ui-vscode` patch.
- [x] 6.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.

  Done: all pass after staging; `lint:screenshots` counts 36 pictures, all
  captured, with `timeline-change-light.png` and `timeline-change-dark.png`
  among them.

- [x] 6.5 The whole standalone browser suite passes. Record the count.

  Done on 2026-09-17: `npm run test:browser -w @openspec-ui/server`, all
  24 tests in one run, 24 passed in 6.3 minutes; run again after 6.6's
  fixes, 24 passed in 8.4 minutes. The pictures the other tests rewrote
  were put back; only the two Timeline pictures are part of this change.

- [x] 6.6 **Delegated to claude-cli.** Live: the Timeline tab against this
  repository on a running server, for an archived change with a squashed
  commit and for an active change, in both themes; and the editor's panel
  for the same archived change in the Extension Development Host. Record
  each screen's moments count, the tile's figures, and the screenshot
  paths.

  Done on 2026-09-17 by Claude, which wrote this change, at the owner's
  request, for the owner to look at in turn. A server from this branch ran
  against this repository's worktree, and Playwright chose each change in
  the Timeline tab at 1280 pixels, in both themes:

  - `2026-09-14-a-run-says-which-task-it-is-on`, archived: 5 moments, one of
    them "27 tasks ticked in one commit"; the tile "29 / 29", "proposed to
    archived in 10 h 07 min"; each of the four dates with its source; read
    in 4.6 seconds.
  - `a-screen-says-what-it-is-doing`, active: 2 moments, one of them "41
    tasks ticked in one commit"; the tile "41 / 43", "proposed to last
    worked in 6 h 02 min"; no Archived row; "Still open" listing 5.6 and
    5.7; read in 3.6 seconds.

  In the Extension Development Host built from this branch, with this
  repository open, "Show Change Timeline" on the archived change's row in
  the Archive view drew the same 5 moments and the same tile under the
  heading, in Default Dark Modern and Default Light Modern; the panel was
  1077 pixels wide, and the columns 659 and 330.

  The first run found two faults, both fixed before the run recorded here:

  - Choosing the active change after the archived one left the archived
    timeline on the screen, and its name in the page head, for the seconds
    git took. Choosing now puts it away at once; 3.2, the spec's new
    scenario, and `frame-screenshots.spec.ts` say so.
  - A task read as its first line of `tasks.md` alone, cut mid-sentence and
    with its Markdown marks: "`commandInstruction("implement")` in". 1.8 and
    1.9 give the whole sentence, on one line.

  The live pictures were taken outside the repository and are not kept;
  `docs/images/standalone/timeline-change-light.png` and
  `timeline-change-dark.png` show the same screen from the fixture.

- [x] 6.7 **Human-only.** Whether the screen, in the browser and in VS Code,
  matches the mockup's "Timeline: one change" artboard.

  Done on 2026-09-17 by Claude, at the owner's request ("if there are human
  parts again, take them on yourself"), for the owner to look at in turn.
  Compared with the artboard, in the browser and in the editor's panel, in
  both themes: the toolbar is one row, with the three modes as one
  segmented control, the picker, and "Stale after" at its right; "Tasks
  over time" puts the proposal, each moment and the archive on a rail with
  a dot each, grey, blue and green, the time above what happened, and a
  group opens to its first three tasks and "and N more"; the Tasks tile and
  the Dates panel stand to its right, with the note on squashed commits
  under the dates; the page head names the change. What the artboard does
  not draw, and the screen keeps below the columns, is "Still open", "Done,
  date unknown" and "Documents". The editor's panel has no toolbar and
  carries the change's name as its own heading instead of a page head.
