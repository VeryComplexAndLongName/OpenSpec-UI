## Context

`ChangeTimelineView` draws a `ChangeTimeline` it is given: a header with the
created and archived dates, the proposal, design and specs as rendered
markdown, and then every task as a row of Metro's `.timeline`, sorted by the
date git blame gives its line. Both hosts draw it: the standalone Timeline
tab, after a person picks a change and presses Load timeline, and the
editor's timeline webview, from a timeline the extension host read.

The timeline already carries more than the view shows. `dates` holds
`proposed`, `firstWorked`, `lastWorked` and `archived`, each a `DatedFact`
with its `source`: `git-commit`, `git-blame`, `audit-log`, `folder-name`,
`unreadable` or `none`. Each task has `date` (when its done line was last
touched, for a done task), `lastTouchedDate`, `text` beginning with its
number, and `section`.

The mockup's artboard, "Timeline: one change", draws an archived change of
this repository: a toolbar, then two columns — "Tasks over time" on the
left, a Tasks tile and a Dates panel on the right.

## Goals / Non-Goals

**Goals:**

- The one-change screen matches the artboard in both themes.
- Every task and date the view shows today is still reachable.
- The editor's panel draws the same view.

**Non-Goals:**

- **Compare changes and the sprint report.** Compare changes is its own
  change: the mockup's Gantt needs every change's dates, and reading them
  one change at a time took minutes on this repository.
- **Reading anything new.** Core's `ChangeTimeline` has what the artboard
  shows, but for the end of a task's sentence where `tasks.md` wraps it,
  which core now keeps from the file it already reads.
- **Changing how a task's date is found.** A task ticked in a squashed
  commit keeps that commit's time; the screen says so instead.

## Decisions

### Moments are derived in one pure module

`packages/webui/src/timeline-moments.ts` turns a `ChangeTimeline` into what
the view draws: the ordered moments (proposed, each group of tasks sharing
one `date` instant, archived), the open tasks with their staleness, the done
tasks without a date, the tile's figures, and the Dates panel's rows with
their source words. The view draws what it returns.

It lives in webui, beside `summary-figures.ts`, rather than in core: both
hosts draw it through the one component, and nothing outside a screen asks
these questions.

Tasks group on the same instant, not the same day. Two commits an hour
apart are two moments; the artboard's "27 tasks ticked in one commit" is
the case that matters.

A task's number and title come from its text: a leading `1.1` is the
number; the rest is the title.

### A task reads as its whole sentence, on one line

`tasks.md` wraps a task at about 76 columns, and core's checklist item held
the checkbox line alone, so the live check against this repository showed
titles such as "`commandInstruction("implement")` in", cut mid-sentence,
with their Markdown marks. Core's parser now keeps the indented lines
straight after a checkbox line, up to a blank line, a list item or a
heading, as `continued`; a record written under a task after a blank line
is not part of it. `text` stays the checkbox line, since every marker and
declaration is read from it. The parse belongs to core, and the Pipeline's
task rows can use the same field.

The view joins the two, takes off `**` and backquotes, and draws the title
on one line with an ellipsis, as the artboard draws a task, with the whole
sentence on hover.

### Choosing again clears what is shown

Choosing another change puts the shown timeline away at once. Kept up while
the next one was read, it sat under a picker naming another change, with its
own name in the page head, for as long as git took.

### Times are local, and said so

Each moment reads "Sun 13 Sep, 18:40" in the viewer's zone, as the artboard
does, and the panel's head says "times are local". The formatter takes a
locale and a time zone, so the test is not the machine's.

### Choosing a change loads it

The picker's change event loads the timeline. The Load button goes, as the
artboard has none. A failed load says so in the toolbar and leaves the
picker as chosen, so choosing again retries.

The stale threshold is applied when the view draws, so changing it redraws
at once, without reading git again.

### The page head names the change

While a timeline is shown, the tab's page head reads the change's name as
its title, "Timeline" above it, and "Archived" or "Active" with "each task
placed when git shows it was ticked" under it. Without one, the head is the
tab's own.

### What the rail cannot place stays below it

The rail holds only what has a time. Below the two columns, "Still open"
lists open tasks by number, with a Stale badge past the threshold, and
"Done, date unknown" lists done tasks git gave no date. "Documents" holds
the proposal, design and each spec, each closed in a `<details>` element.
Nothing the view shows today is lost.

### One column when narrow

Under 760 pixels the right column moves under the rail. The editor's panel
is usually half a window, and a webview's viewport is the panel.

## Risks / Trade-offs

- **A change with hundreds of tasks ticked one by one** gives hundreds of
  moments. That is what happened; the rail scrolls with the page.
- **The editor's panel shows no toolbar.** It opens on one change and
  has no picker; the heading names the change.
- **Locale.** The format is the artboard's English one, whatever the
  browser's language, like the rest of the shell.
