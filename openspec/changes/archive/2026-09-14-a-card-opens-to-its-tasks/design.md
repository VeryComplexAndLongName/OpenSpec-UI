# Design

This change implements two decisions from
`docs/adr/0029-the-pipeline-is-where-a-change-is-run.md`: "A card opens to
its tasks, and every line says what it means" and "A card's size is
derived from what it shows". It also implements the 2026-09-13 amendment
to ADR 0025.

## Context

**Layout.** `layoutChanges` in `change-layout.ts` returns each node's
`x`, `y`, `width` and `height` in layout units:

- `NODE_WIDTH` is 16, `NODE_HEIGHT` is 5, `COLUMN_GAP` is 6 and `ROW_GAP`
  is 1.5.
- Rows are ordered by name within a column.
- `y` is `row * (NODE_HEIGHT + ROW_GAP)`.
- Edges between neighbouring columns meet each card at mid-height. An edge
  that skips a column detours through a lane below the grid.
- `gridHeight` is the largest `y + height`.

**Card size.** `pipeline-card.ts` holds the card's vertical sizes as
`rem` tokens and turns a height into a detail-line budget. The stylesheet
is generated from those tokens, and a test keeps the two together.

**The card element.** A card is a `<button>` placed with `--x`, `--y`,
`--w` and `--h`. It has a fixed height and `overflow: hidden`. Below
720px, cards become lanes with `height: auto`.

**The task list.** `readTaskChecklist` yields items with a line number,
text, done, and optional `check`, `humanOnly` and `delegatedTo`. It
records no section and no nesting. `taskNumberOf` derives an item's
number.

**What a card already knows.** After `a-card-says-what-its-change-is-doing`,
each card carries its task in hand or a labelled guess, and the survey
carries each change's counts and first open task.

## Decisions

### The tasks travel with the survey

`SurveyedChange` gains `tasks`, the rows of the task list: number, text,
section, done, and who may close the item. The survey already reads every
list in order to count it.

Rejected:

- **A separate reading when a card opens.** The request would have to name
  a directory, and a message that names a path is what the bridge refuses
  by rule. It would also add a second cadence to keep in step with the
  survey. The rows of this repository's lists amount to a few kilobytes
  per reading.

### Sections come from the headings

Core records, for each item, the nearest `## ` heading above it, with the
heading's leading number removed.

Rejected:

- **Grouping by the number prefix.** The words are in the heading, and
  some lists are not numbered.

### A row states its state in words, from a closed set

The words are: done, in hand, probably next, open, only a person can close
it, and delegated to a named agent. At most one row is in hand or probably
next, and that row is the card's task in hand or its guess.

Rejected:

- **Glyphs alone.** A reader has to be told what a glyph means, and a
  screen reader has to be given a name for it.

### The line between rows is a rail inside the card

A thin rail joins each row to the row listed after it, drawn by the card's
own stylesheet. It never leaves the card, so it cannot be mistaken for the
solid line that joins two cards. It is hidden from assistive technology,
because the list's own order already says "next".

Rejected:

- **SVG edges between rows.** They would make a row look like a node, and
  the legend would have to separate two kinds of edge in one drawing.

### An open card's height is derived, and a column stacks by height

`pipeline-card.ts` gains two tokens, a task row and a section row, and a
function that returns an open card's height in layout units: the closed
height plus one row per heading and per task.

`layoutChanges` accepts a height for each open card. It stacks each
column's cards by the running sum of their heights and `ROW_GAP`, in the
existing name order.

An edge attaches at a card's head: the middle of the closed height. Opening
a card therefore never moves the edges into that card.

Rejected:

- **One row height per grid row, the tallest in that row.** A single open
  card would push every column down.
- **Measuring the open card.** ADR 0025's reasons still apply.

### Zoom is one unitless factor on the picture

The picture's container carries `--pipeline-zoom`. `--u` becomes the zoom
factor times `1rem`, and every card type size is multiplied by the same
factor. Zoom steps through 75%, 90%, 100%, 125% and 150%, and the control
states the current step.

Rejected:

- **Changing `--u` to an `em` and setting a font size.** ADR 0025
  explains why a custom property in `em` moves whenever a card sets its own
  font size.
- **CSS `zoom` or `transform: scale`.** Either one scales the drawing
  without scaling the text as text. `transform: scale` also leaves the
  scroll area at the unscaled size.

### What a viewer left is remembered by the host

`PipelineView` takes a `viewState` reader and writer: the zoom, and the
open cards keyed by directory path and change name.

- The standalone shell stores it in `localStorage`, and every read and
  write is guarded, because a browser can refuse storage.
- The editor stores it in the webview's own state.

Rejected:

- **Keeping it only in the component.** The editor destroys a hidden
  webview, because the panel does not retain its context, so the view
  would reset every time the panel was hidden.

### The legend appears when the picture has something to explain

When the picture has an edge or an open card, a legend above it says:

- a solid line means "waits for";
- a thin line inside a card means "listed next in tasks.md";
- a collision is written on the card, and never drawn.

## Non-Goals

- Declaring or drawing dependencies between tasks.
- Controls on a task row.
- Opening a card by default.
- Zoom steps beyond the five listed above.

## Risks / Trade-offs

- **A long list makes a tall picture.** The picture already scrolls in its
  own container (ADR 0025), and Close all is one control.
- **A reader's minimum font size can make rows taller than the tokens
  say.** This is the cost ADR 0025 accepted for a closed card. The browser
  suite's line check covers the default size and 150% zoom only.
- **The survey payload grows by the task rows.** It stays at kilobytes
  for this repository, and is read every 30 seconds in the standalone
  shell.
- **Stacking by height loses alignment between columns.** Row n of one
  column no longer lines up with row n of the next. Edges still attach at
  card heads, so each relation is still drawn where the reader looks.
