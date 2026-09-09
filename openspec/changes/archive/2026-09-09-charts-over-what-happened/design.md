# Design

## Context

`ChangeTimeline` carries `dates` — proposed, first worked, last worked,
archived — each with the source it was read from. Both hosts already
render the same components: the standalone shell mounts
`MultiChangeTimelineView` in its Timeline tab, and the extension's
timeline panel loads `timeline-entry.tsx`, which mounts the same thing.
A chart component added beside it reaches both.

## Decision: two charts, chosen by measurement

Bars for what was archived per day; a histogram for how long a change
took from proposal to archive. Both are magnitude-over-something, which
is what a bar is for.

The two that are not drawn — the work span and the wait before work —
were measured first and are flat: 135 of 185 changes have exactly zero
days between proposal and first tick. A flat chart is not a neutral
thing to ship; it reads as a finding.

## Decision: the source is stated under every chart

The dates carry where they came from, and a chart that drops that is
back to plotting a naming convention as if it were a measurement. Each
chart states how many of the values it drew came from a commit, from a
folder name, and how many changes it left out for having no date at all.

## Decision: one series per chart, in the shell's own primary

No categorical palette, so no hue order to get wrong and no legend to
carry: a single series is named by the chart's title. The bar colour is
`--primary`, the token both hosts already define — the standalone shell
to its own green, VS Code to the button colour of whatever theme the
person is using, which is how these charts get a dark mode that is the
host's rather than an inverted guess.

Validated rather than eyeballed: `#1f5d52` on this shell's surface
passes contrast at ≥3:1. It fails the categorical chroma floor, which
applies to palettes that must be told apart from each other — there is
one series here, so there is nothing to tell it apart from.

## Decision: a table beside every chart, not behind a toggle

Each chart renders its numbers as a table underneath. It is the
accessible form, it is what someone copies into a message, and a toggle
would hide half of that behind a click for no gain on a page this size.

## Decision: `<title>` per bar rather than a tooltip layer

A native SVG `<title>` is read by screen readers and shown on hover by
every browser, with no positioning code, no portal and no state. The
values are also in the table below, so nothing is only in the hover.

## Decision: the timeline plots the real archiving moment

`MultiChangeTimelineView` anchors an archived change to `23:59:59.999`
of its archiving day, because `archivedDate` was a plain calendar date
parsed from the folder name and would otherwise plot before that day's
own task ticks. `dates.archived` is a commit timestamp now, so the
workaround is only needed where the folder name answered — and there it
still is.
