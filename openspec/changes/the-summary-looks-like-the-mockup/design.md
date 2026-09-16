## Context

The mockup's summary (artboard "Summary" and "Summary, dark",
https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L) against the running tab on
2026-09-16, from the owner's screenshot `Summary.png`:

- **The rows are browser buttons.** `ChangesList` and `ArchiveList` render
  each row as a `<button>` with no background rule, so the browser's own grey
  fill draws every row — the grey plates in the screenshot.
- **Dates are ISO timestamps**, `2026-09-16T14:15:49.168Z`.
- **Everything sits in one `openspec-shell-panel`**, the waiting list first,
  then the root line, the tiles, the lists.

## Goals / Non-Goals

**Goals:**

- The summary matches the mockup's artboard in light and dark, down to the
  panel heads, the table columns and the tile notes.
- Nothing the tab does today is lost.

**Non-Goals:**

- The other tabs. Harness Settings and the timelines are the next changes.

## Decisions

### Rows stay windowed buttons, drawn as table rows

`ChangesList` and `ArchiveList` keep their `useVirtualList` windowing and
their test ids, and each row stays one button that opens the change. The
button is laid out as a four-column grid with no fill of its own, under a
column header, which is what the mockup's rows are.

### What a row says

- **Name**, in the heading colour.
- **State**, as a badge: the standing word where standings were read, the
  derived state otherwise. A standing's lines ("Ready · 41 of 43 done in
  screens") sit in small text under the name; the mockup had none to draw.
- **Tasks**, a bar and "done / total". The percentage moves into the bar's
  accessible name.
- **Updated**, as a day ("16 Sep"), with the full timestamp in `dateTime` and
  `title`.

The state column is wider than the mockup's: a standing's word can be
"Further along in screens", which the owner saw drawn over the bar in a
150-pixel column. A word longer than the column is cut inside its badge, and
the badge's title keeps it whole.

The full archive draws its rows as the "Recently archived" table does — the
name without its date prefix, "done / total" with no bar, and the day. The
panel is half the page wide, and in the owner's check a bar there ran into the
day.

### Figures come from one function

`summaryFigures(overview, inbox)` in `summary-figures.ts` returns the four
tiles' figures and notes and the two short lists, so a test can hold them
against a written overview. The tab renders what it returns.

### What the mockup omits goes below, not away

- **The full archive and every spec** open under their panels' "All …"
  controls, with the search the archive has today.
- **Waiting on somebody** keeps its sentence, its rows, its run controls and
  the enrolment requests, in a panel after the lists.
- **The root line** becomes the Changes panel's fine print, beside where refs
  were read from.

### Refresh moves to the page head

`PageHead` takes an optional action. The summary's is Refresh, which reads the
overview and fetches refs, what Load summary and the list's own Refresh did
between them.

## Risks / Trade-offs

- **Browser specs press Load summary** in five places; they press the page
  head's Refresh by its test id instead.
- **A standing's lines make a row taller.** The virtual list's row height
  follows: 44 pixels without lines, 60 with.
