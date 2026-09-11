Two sources answer "which day" differently; one source is unreachable;
one bad folder name breaks the request; a sentence about this repository
is shown to everyone.

## 1. One day for one action

- [x] 1.1 `packages/core/src/change-dates.ts`: a `DatedFact` carries the
  instant with its offset as recorded, and a `day` taken from that
  string before normalisation. Every reader of `slice(0, 10)` reads
  `day` instead: `change-timeline.ts:362`, the sprint report, the
  timeline view, the per-day chart.

  Corrected as written: `DatedFact.date` keeps the *normalised* instant
  and `day` carries the offset's answer. The offset lives on the
  evidence handed in — `getFileCreatedDate`, `getPathAddedDate`,
  `readArchiveCommitDates` and `blameLineDates` all return git's own
  string now — and is read by `readDatedFact` before it normalises. A
  set of instants in mixed offsets sorts by its offsets under
  `localeCompare`, which is how `ChangeTimelineView` orders tasks and
  how the sprint report compares a range, so publishing the raw form
  would have broken both.

  `slice(0, 10)` had exactly one reader, `change-timeline.ts:362`
  (`archivedDate`); the sprint report, the timeline view and the
  per-day chart all read *that* field, and now read `dates.archived.day`
  through it.
- [x] 1.2 The folder-name source stamps its day without an offset and
  its `day` is the prefix.
- [x] 1.3 A test with a commit at `02:30+03:00` asserting the day is the
  27th from the commit source and from the folder source alike.
  `change-dates.test.ts` "gives an after-midnight commit and the folder
  it named the same day", and end to end through a real git repository
  in `change-timeline.test.ts` "gives an after-midnight archive the day
  its own record names".

## 2. The audit-log source reaches the hosts

- [x] 2.1 `getChangeTimelines` accepts audit timestamps per change; the
  server route and the extension command read the audit log once per
  request and pass them.

  The grouping is `runTimestampsByChange` in `audit-runs.ts`, beside the
  other rule about which entry belongs to which change; both hosts call
  it. An archived change is looked up under the name it had when the
  runs were recorded as well as under its dated one — archiving renames
  the directory the log holds, so the dated name alone would have found
  nothing.
- [x] 2.2 A test through `getChangeTimelines` where a run precedes the
  first ticked task, asserting `firstWorked.source === "audit-log"`.
  Three: `change-timeline.test.ts` "dates the work from a run when the
  host passes the audit log to the batch call" and "finds an archived
  change's runs under the name it had when they were recorded", plus
  `server.test.ts` "dates work from the audit log it reads for the
  request", which goes through the real route.

## 3. Never throws

- [x] 3.1 One parse helper in `change-dates.ts` returns absent for a
  string `Date` cannot read, with source `unreadable`; every source
  parses through it.
- [x] 3.2 A test with `archive/2026-13-01-typo` and no commit: the
  timeline is returned, the archived date is absent, and its source says
  why. `change-timeline.test.ts` "returns every other change's dates
  when one folder name is not a date", with the pure case in
  `change-dates.test.ts`.

## 4. The archive read reads what git prints

- [x] 4.1 `readArchiveCommitDates` uses a delimiter that cannot appear
  in a path, resolves paths against `git rev-parse --show-toplevel`, and
  handles `core.quotePath` output or disables it with `-c
  core.quotePath=false`.

  The delimiter is `\x1f`, in front of every date line. Paths are
  resolved against `git rev-parse --show-prefix` rather than
  `--show-toplevel`: `--show-prefix` *is* the cwd's path relative to the
  top level, so the prefix git puts in front of each path is read
  directly instead of computed by comparing two absolute paths that
  Windows can spell differently (case, short names) — a comparison that
  would fail to nothing on exactly the workspaces this is fixing.
  `core.quotePath=false` is passed, and a quoted path is unquoted
  anyway.
- [x] 4.2 It returns the count of lines it could not read beside the
  map, and `getChangeTimelines` reports that count in the timeline's
  basis so a silent fallback becomes a visible one.
  `ChangeTimeline.archiveDatesUnreadableLines` carries it, `ChartBasis`
  picks it up, and `describeBasis` says "N archive log lines were
  unreadable; those dates were read one change at a time."
- [x] 4.3 A test with the workspace under a directory named `Core`.
  `change-timeline.test.ts` "reads the archive of a workspace nested
  under a directory named Core" — the repository root is above it, so
  git prints `Core/openspec/changes/archive/...`.

## 5. Chart arithmetic in core

- [x] 5.1 Move `archivedPerDay`, `leadTimes`, `LEAD_BUCKETS`,
  `describeBasis` and their tests from `packages/webui/src/change-charts.ts`
  to a leaf module in core exported through `browser.ts`. The webui
  component imports them.
- [x] 5.2 Add `describeWorkDurationNotCharted(timelines)` in the same
  module: how many changes, how many with zero days from proposal to
  first finished task, and the threshold. `ChangeChartsView.tsx` renders
  it in place of the constant sentence.
- [x] 5.3 Rename the lead-time buckets by their boundaries: "Under a
  day", "1–2 days", "2–3 days", "3–8 days", "8 days or more".
- [x] 5.4 Move `readOpenTaskCount` from
  `run-with-harness-dispatch.ts` to core beside the task checklist.

  Only the count moved, as `openTaskCount` in the new leaf module
  `task-checklist-counts.ts`; the fetch around it is that host's
  transport and stays there. Moving it found two more copies of the same
  line in the extension's command handlers, and all three call the core
  function now.

## 6. Tests that reach what they name

- [x] 6.1 `change-timeline.test.ts`, the folder-name case: commit the
  archive on a different day from the folder's, or without a commit,
  and assert `dates.archived.source === "folder-name"`.

  The first of those two cannot assert `folder-name`: a commit wins over
  the folder whichever day it falls on, so committing on a different day
  yields `git-commit`. Both are covered by two tests instead — the
  original, renamed to say it is the commit path and now committing on
  the 5th while the folder says the 3rd, and a new "falls back to the
  folder name when no commit moved the change", which moves the
  directory and does not commit.

## 7. Verification

- [x] 7.1 `openspec validate --strict --changes`. Run 2026-09-10: exit
  0, 9 passed, 0 failed.
- [x] 7.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run.

  Run 2026-09-10: exit 0 — 48 cli, 915 core, 320 extension, 80 server,
  352 webui.

  And the whole browser suite, `npm run test:browser --workspace
  @openspec-ui/server`, 2026-09-10: 11 passed. It rewrote two
  screenshots under `docs/images/standalone/`, neither staged:
  `change-charts.png`, because the lead-time bucket labels and the
  sentence under the charts are what this change alters, and
  `harness-settings.png`, whose only difference is the version footer —
  `core 0.62.0 · server 1.17.0 · webui 1.33.0` became `0.63.0 / 1.18.0
  / 1.34.0`, which the release commit already on this branch changed
  and nothing re-captured.
- [x] 7.3 Version bump via `npx changeset` for core, webui, server and
  the extension. `.changeset/a-date-is-one-day-in-every-source.md`,
  minor for all four.
- [x] 7.4 Render the charts over this repository and look at them, as
  `charts-over-what-happened` did; confirm the early-morning archives
  moved to the day their own records give.

  Two corrections to this item as written. The change it names is
  `charts-over-what-happened`, not `charts-of-what-was-finished`. And
  "the day their folders say" is right for one of them and wrong for the
  other two: three commits fall in the band, not two, and two of them
  move *away* from the folder's day, because `openspec archive` named
  those folders before midnight and the commit landed twenty-four
  seconds after it. The commit is the measurement in both directions.

  Run 2026-09-10, the real standalone app over this repository, all 201
  changes selected, 2026-08-01 to 2026-09-11, screenshot captured by
  Playwright and looked at:

  - **Archived per day**: 34 columns from 2026-08-08 to 2026-09-10, 24
    of them carrying something; busiest 2026-09-02 with 24. Basis: "192
    changes · 192 dated from a commit." Nothing excluded, no folder-name
    date, and no unread archive-log lines — the one-call read handled
    all 192 on a repository whose root is `C:\Prog\OpenSpec-UI`, which
    the old `startsWith("C")` test would have failed had the workspace
    been the nested case.
  - **Days that moved**, against the same log read the old way: 08-26
    15 -> 14 and 08-27 2 -> 3 (`2026-08-27-add-stale-task-detection`,
    committed `02:30:40 +03:00`, onto the day its folder names); 09-08
    20 -> 18 and 09-09 17 -> 19 (`2026-09-08-run-dialog-actually-
    advises` and `2026-09-08-source-stays-text`, both committed
    `00:00:24 +03:00`, off the day their folders name). The rendered
    table shows exactly 14 / 3 / 18 / 19.
  - **How long a change took**: Under a day 138, 1–2 days 26, 2–3 days
    9, 3–8 days 14, 8 days or more 5. Nothing excluded. The row labels
    sit clear of the bars at every length, which is what looking at the
    picture is for.
  - **The sentence under the charts**: "How long the work itself took is
    not charted: 190 of 199 changes have exactly zero days between being
    proposed and their first finished task. Past 50% the chart would be
    a flat line presented as a finding." Computed, and neither "135 of
    185" nor "this repository" appears anywhere on the page.
- [x] 7.5 **Delegated to copilot-cli**: drive the standalone shell with
  Playwright, open the timeline, and assert the sentence under the
  charts carries the shown workspace's own change count and its own
  count of flat changes — not the constant "135 of 185".

  Premise corrected: the item said "over this repository". A test whose
  expected numbers are this repository's own fails the next time anyone
  archives a change, which is the kind of check that gets deleted rather
  than fixed. It runs over the dated fixture instead, whose counts are
  known and stay known, and additionally asserts the sentence carries
  neither "185" nor "this repository" — the two halves of the constant
  it replaced.

  Evidence: `packages/server/e2e/change-charts.spec.ts`, "charts what
  the history says, and says what it rests on". The fixture compares
  five changes, each carrying a finished task committed with its
  proposal, and the rendered sentence reads "5 of 5 changes have exactly
  zero days between being proposed and their first finished task". Run
  2026-09-11: 1 passed, 12.5s.

  Read directly rather than through the named agent: nothing dispatches
  a delegated item yet, so the marker names who would run it once
  something does.
