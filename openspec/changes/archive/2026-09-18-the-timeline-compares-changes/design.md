## Context

The Timeline tab has three modes. "One change" was redrawn from the
mockup's artboard by `the-change-timeline-looks-like-the-mockup`; "Compare
changes" and "Sprint report" were left as they were.

Compare changes today: two `<input type="date">` fields, a `<select
multiple>` listing every active and archived change, and a Load comparison
button. Pressing it posts the selected entries to
`POST /api/change-timelines`, which reads a whole `ChangeTimeline` per
change — every artifact's text, the task list, `git blame` over `tasks.md`
and `git log --follow` over `proposal.md` — and hands them to
`MultiChangeTimelineView`, a grid of days with one marker per event, and to
`ChangeChartsView`.

The editor has the same thing behind
`openspec-ui.showAllChangesTimeline`: a multi-select quick pick, then a
one-shot webview with the same two components and a range derived from the
selected changes' own dates.

The mockup's "Timeline: compare changes" artboard
(<https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L>) draws what ADR 0033
decision 4 describes: a toolbar of modes, a period as a segmented control,
a filter field and a legend; a panel whose first column names the change
and whose other columns are days, weekends shaded; one row per change with
a bar from proposed to archived and its figures beside it; a dashed line
marking now; and the footnote "Click a row to open that change's own
timeline."

Measured on this repository on 2026-09-17, 2 active and 262 archived
changes:

| Read | Cost |
| --- | --- |
| `getFileCreatedDate` per change (`git log --follow`) | 62 s |
| One `git log` over both `proposal.md` globs | 209 ms |
| `readArchiveCommitDates` (already batched) | 262 ms |
| `discoverOpenSpecWorkspace`, active and archived | 585 ms |
| Every `tasks.md` counted | 110 ms |

## Goals / Non-Goals

**Goals:**

- The comparison matches the artboard in both themes and in the editor.
- Entering the mode draws the whole workspace without being asked what to
  compare.
- The dates it draws mean exactly what the one-change screen's dates mean,
  and carry the same sources.
- A row is a way into that change's own timeline.

**Non-Goals:**

- **Changing what a date is.** `DatedFact`, its sources and the day rule
  are `change-dates-from-evidence`'s and stay as they are. This change adds
  a second way to gather the same evidence, not a second meaning.
- **Dating work in the batch read.** First and last worked come from
  `git blame` over one `tasks.md` and from the audit log; there is no
  one-call form of that, and the bars the artboard draws do not use them.
  The comparison's charts read the full timelines for the rows on screen,
  where those dates come from the same place they always did.
- **The sprint report.** Its mode, its range fields, its selection list and
  its command are untouched.
- **A live comparison.** The screen reads when it is opened, when the
  period or the filter changes what it needs, and when the workspace root
  changes. Nothing watches the repository.

## Decisions

### One pass over the workspace, in core

`packages/core/src/change-spans.ts` exports `readChangeSpans(root)`,
returning one `ChangeSpan` per change — its name, whether it is archived,
its `proposed` and `archived` `DatedFact`s, and its `TaskCounts` — from
four reads for the whole workspace rather than four per change:

1. `discoverOpenSpecWorkspace(root)` for the list of changes and the paths
   of their artifacts.
2. One `git log --no-renames --diff-filter=A --name-only` over
   `openspec/changes/*/proposal.md` and
   `openspec/changes/archive/*/proposal.md`, whose oldest entry per change
   is when that change was proposed.
3. `readArchiveCommitDates(root)`, which already answers the archive in one
   call.
4. Every change's `tasks.md`, counted with `countTaskCheckboxes`, through
   `mapBounded` at the limit `the-pipeline-reads-each-workspace-once`
   settled on.

The facts are assembled by `buildChangeDates`, the same function the
per-change read uses, so a source word here means what it means there.

`--no-renames` is the point of step 2: archiving renames
`openspec/changes/<name>/proposal.md` to
`openspec/changes/archive/<day>-<name>/proposal.md`, and git with rename
detection on reports that as a rename rather than as an add. Without it,
both paths are adds, and the oldest add of either is when the change was
proposed. A change proposed and archived in one commit has only the archive
path, which is the right answer for it.

**Rejected: keep `git log --follow` per change and make the screen wait.**
62 seconds to draw a screen is not a screen. The same measurement is what
`readArchiveCommitDates` exists for, one level down.

**Rejected: cache the dates in a file.** A cache of git's own answers has
to be invalidated by the thing it caches, and 1.2 s does not buy a cache
file, a schema for it and a staleness rule.

**Rejected: read the dates from the audit log or the archive folder names
alone.** Both are conventions, and
`a-date-is-one-day-in-every-source` already settled that a convention is
the fallback, not the source.

### The batch read and `--follow` can differ, and the read says which it is

`git log --follow` tracks a file through renames by content similarity, so
it reports when the file first existed anywhere; the batch read reports
when `proposal.md` first appeared at that change's own path. They differ
for a change renamed after it was proposed.

Measured across this repository's 264 changes on 2026-09-17: 262 identical
to the second, 2 different — `cross-host-workspace-lease` by 11 minutes and
`standalone-lifecycle-e2e` by 4 minutes, each within its own day, each
because the change was renamed the day it was proposed. The day, which is
what a column is, is the same in both.

Both stay: the one-change screen keeps `--follow`, because for one change
the stronger read costs 240 ms and finds the first draft under any name;
the comparison takes the batch, because for a workspace it is the
difference between a screen and a wait. The source word is `git-commit` in
both, which is true of both.

**Rejected: make the one-change screen use the batch read too**, for one
number that agrees with the other screen. It would lose a rename's history
for the one screen where it can be afforded.

### The geometry is derived in core, not measured

`packages/core/src/change-comparison.ts` is pure and browser-safe, beside
`change-layout.ts` and `pipeline-card.ts`, and answers everything the view
draws:

- `comparisonWindow(range, spans, now)` — the days of the period, each with
  its heading, whether it is a weekend, and the instants it spans. `All`
  starts at the earliest proposed day (46 days on this repository on
  2026-09-17, from 3 August).
- `comparisonRows(spans, window, now, filter)` — one row per change whose
  span meets the window, ordered by when it was proposed, each carrying the
  bar's start and end as a percentage of the window, whether it was clipped
  at either edge, its label ("47 tasks" archived, "25 / 27" active), and
  which side of the bar the label goes on.
- `nowOffset(window, now)`, `describeComparison(rows, window)` — the dashed
  line's position and the page head's sentence.

The view multiplies no lengths and measures no element: it sets the
percentages it is given as custom properties, exactly as the Pipeline's
picture does (ADR 0025). A day is a column of a CSS grid whose track is
`max(100%, days × a minimum)`, so five days fill the panel and 46 days
scroll sideways under a sticky name column.

**Rejected: positions in pixels from core.** A percentage is what survives
a panel that is 1180 px in the browser and 900 px in an editor pane.

**Rejected: a day-resolution grid, with a bar spanning whole columns.**
ADR 0033 says "the day and hour a change was proposed"; a repository whose
changes are proposed and archived on the same day would draw every bar
identically.

### The rows are the changes that were open in the period

A row is drawn for every change whose span meets the window: proposed
before the window ends, and archived after it starts or not archived at
all. A bar cut by an edge is drawn square at that edge rather than rounded,
so a span that began before the period is not read as having begun at its
left edge.

A change with no readable proposed date carries no bar. It keeps its row,
with its dates' absence stated in the row's accessible name, rather than
being dropped from a screen that claims to compare the workspace.

### The screen is one component, driven by two hosts

`packages/webui/src/components/ChangeComparisonView.tsx` takes the window
and the rows core derived, the period and the filter with their handlers,
`now`, the histories its charts have, and a callback for opening a change.
The standalone tab and the editor's webview both draw it, as they both draw
`ChangeTimelineView`.

It takes the derived rows rather than the spans because its host needs the
same rows anyway — to ask for their histories — and deriving them twice
from one set of inputs is two answers waiting to differ. It also takes a
`leading` slot for controls that belong to the host: the standalone shell
puts the Timeline's three modes there, so the screen keeps the one toolbar
row the artboard draws, and the editor's panel passes nothing.

`MultiChangeTimelineView.tsx`, its test, its tokens and its styles go with
it: the grid of markers is what this screen replaces, and keeping both
would leave two answers to "what does the comparison look like" in the same
bundle.

### The charts follow the grid, and are read after it

`ChangeChartsView` needs whole `ChangeTimeline`s — it names the sources
each chart rests on, and the work-duration sentence needs the first worked
date, which no batch read produces. So the screen draws the grid from the
spans at once and then asks its host for the histories of the rows it is
showing, keeping what it has already been given; the charts appear under
the grid when they arrive, with a note saying they are being read.

Reading them is why `getChangeTimeline` stops calling
`discoverOpenSpecWorkspace(root)` for the whole workspace once per change
and asks for the one change by name, which
`the-pipeline-reads-each-workspace-once` made possible: 585 ms per change
against 264 changes was the greater half of that read.

**Rejected: computing the charts from the spans.** Two of the three figures
would be right and the third — how long the work itself took, the sentence
that exists to say a chart is *not* drawn — would silently become a
different measurement.

**Rejected: dropping the charts from the comparison.** "What a project
finished is readable as a chart, in every host that shows the timeline" is
a requirement, and this screen is where it is shown.

### The editor's panel gains two messages

`TimelineWebviewPanel.showComparison` opens the webview with the spans
embedded, as the one-shot panel has always embedded its data, and listens
for two messages from it:

- `read-timelines` with the entries the charts need, answered with
  `timelines` carrying `getChangeTimelines`' result, or `timelines-failed`
  carrying the message. The webview keeps what it is sent, so a period
  changed twice asks for nothing twice.
- `open-timeline` with a change's name, which opens that change's own
  timeline panel.

This is the message bridge ADR 0001 names as the extension's primary mode,
not a local server: the host keeps reading through its direct core import.

**Rejected: embedding every change's whole timeline up front.** It is the
62-second read, plus megabytes of proposal text in the webview's HTML, for
charts the reader may never scroll to.

**Rejected: leaving the quick pick in front of the editor's command.**
Then the editor's comparison would answer a different question from the
browser's, and the pick over 264 changes is the burden this change removes.

## Risks / Trade-offs

- **A workspace with a long history draws a wide grid.** 46 days scrolls
  sideways here; a repository two years old would be 700 columns. The
  minimum day width shrinks by period, the name column stays put while the
  days scroll, and All is one press away from 2 weeks. Whether that reads
  is the question `the-web-ui-screens-wear-metro` 6.7 left open, and it is
  this change's human-only check.
- **The charts lag the grid.** For All on this repository that is 264
  histories to read after the grid is already on screen. The note says so,
  the grid is usable meanwhile, and a reader who does not scroll never
  waits.
- **Two ways to date a proposal now exist in core.** They agree on 262 of
  264 changes here and on the day for all 264, both report `git-commit`,
  and `change-spans.test.ts` states the rule each follows. The alternative
  — one shared, slower read — is what made the screen unusable.
- **`--no-renames` mis-dates a change whose directory was renamed by hand
  while it was active**, reporting when the new name first appeared. The
  one-change screen still follows it, and the difference is a day at most
  in the two cases this repository has.
- **The filter is a substring match**, not the picker's word matching, and
  types as it goes: the rows are already in the browser, so filtering costs
  no read. Only the charts re-read, and only for rows they have not seen.

## Protocol

No command or event of the run protocol changes. The REST surface gains one
route, `POST /api/change-spans`, which takes `{ cwd }` and returns the
spans; `POST /api/change-timelines` keeps its shape and its callers. The
editor's timeline webview gains the two messages above, which no other
webview or host reads.
