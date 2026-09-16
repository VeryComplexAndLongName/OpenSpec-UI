## Context

ADR 0032's screens. The change this one follows,
`the-web-ui-wears-more-metro`, has already put `panel`, `card`, `badge` and
`timeline` into the derived copy with their 18 variables mapped for VS Code,
shipped the icon set as an inlined subset with `iconFor`, and declared each
filled hue with the ink that passes AA on it. Nothing here adds to the
framework; it spends what is there.

The shell draws today, by hand: `openspec-shell-panel` per tab,
`openspec-status-card` and `openspec-data-card`, the timeline rails of
`openspec-timeline-task-*`, and `MultiChangeTimelineView`'s log-scaled lanes.

## Goals / Non-Goals

**Goals:**
- A form reads as named sections, each with an icon that says what it is
  about.
- A change's history reads as a timeline, and several changes read as one
  picture over a single axis of time whose positions are dates.
- An action is recognisable by its icon before its word is read.
- One arrangement is drawn by one stylesheet, not two.

**Non-Goals:**
- **The Pipeline picture's geometry.** It is derived and drawn by hand
  (ADR 0025); only its card controls gain icons.
- **New data.** Every view keeps its current props and its current source.
- **Metro's layout language.** No tiles, app bar or side navigation.

## Decisions

### Harness Settings is panels, one per section

Each `openspec-harness-section` becomes `<section className="panel">` with
`<div className="panel-title">` carrying the section's name and its icon in
the title's left slot. The stage rows and the two-column fields inside are
untouched.

This is what ADR 0032 amended ADR 0023 for: a named section of a form is a
separate object, and may be a panel. A heading, the tab strip and a list row
still may not.

Rejected: a `card` here. Metro's card header has no icon slot, and the
settings sections are parts of one form rather than objects standing beside
each other.

### The per-change timeline is Metro's `.timeline`

One `li` per task, the date in `.time`, the text in `.data`, the dot and the
line Metro's own. The expand-on-click detail and the stale marker stay, since
they carry facts the dot does not.

### The multi-change view is a grid over one axis of time

A sticky first column names the change; a day axis runs along the top; one
block per event is placed by `grid-column`. This is the project site's Release
History shape, written as the shell's own CSS because Metro has no such
component — its `.timeline` is strictly vertical.

Rejected: Metro's `.timeline` here too. It would turn a comparison into a
stack of separate lists, and comparison is the reason this view exists.

Rejected: keeping the log-scaled lanes. A position on them cannot be read back
as a date, which is what a reader wants from a timeline.

### The summary is tiles, and a state word is a badge

A count becomes a tile: a coloured square holding an `Icon`, then a label and
a figure, in the shape the project site uses for its KPIs. A change's state
word in `ChangesList` becomes a `.badge` carrying the state's existing colour
token, and keeps its `openspec-change-state--*` class so the tests that read
it still do.

### What the shell's own CSS loses

`openspec-status-card`, `openspec-data-card`, the per-section rules of
`openspec-shell-panel` and the timeline rail rules of
`openspec-timeline-task-*` are removed in the same tasks that replace them, so
the branch never carries two ways to draw one thing.

## Risks / Trade-offs

- **An icon can say less than a word.** Every icon sits beside its label, none
  is the only carrier of meaning, and each is hidden from the accessible name.
- **A dense grid can be unreadable at a year's width.** The Human-only task
  says so explicitly, and the check is a person looking at it, not a test.
- **A screen can lose a fact in the move.** Each task names what must survive:
  the stale marker, the expand-on-click detail, the state class, the
  Pipeline's geometry.
- **The hosted panels can look foreign** if a variable resolves empty. The
  delegated live check records computed colours in two editor themes rather
  than a verdict that it looks right.
