Measured before decided: 178 changes archived across 19 days, up to 24 in
one; lead times median 0.22d, p90 3.14d, max 10.17d; work spans flat.
Two charts, and two deliberately not drawn.

## 1. The numbers

- [x] 1.1 A pure module turning `ChangeTimeline[]` into what each chart
  plots — no dates arithmetic in a component.
- [x] 1.2 Archived per day, over every day between the first and last so
  a quiet day is a gap rather than a missing column.
- [x] 1.3 Lead time from proposal to archive, in buckets a person reads:
  same day, one day, two, three to seven, over a week.
- [x] 1.4 Every result carries how many changes it drew, how many were
  excluded for having no date, and the source mix of what it used.

## 2. The charts

- [x] 2.1 Bars in `--primary`, the token both hosts define, so the dark
  mode is the host's rather than an inverted guess. Contrast against the
  shell's surface validated at >=3:1 rather than eyeballed. The
  categorical chroma check it fails governs palettes that must be told
  apart from one another; there is one series per chart here.
- [x] 2.2 A `<title>` per bar, so hovering names it and a screen reader
  reads it.
- [x] 2.3 The values as a table under each chart, always — not behind a
  toggle.
- [x] 2.4 The source line under each chart: drawn, excluded, and how many
  dates came from a commit rather than a folder name.
- [x] 2.5 Nothing rendered where there is nothing to draw: no axes over
  an empty set, and a sentence saying so instead.

## 3. Both hosts

- [x] 3.1 The standalone shell's Timeline tab, in its multi-change mode.
- [x] 3.2 The extension's timeline panel, which mounts the same entry.

## 4. The timeline's own dates

- [x] 4.1 An archived change plots at the commit that archived it. The
  end-of-day anchor stays only where the folder name answered, which is
  the case it was written for.

## 5. Tests

- [x] 5.1 A quiet day between two busy ones is a zero, not a missing
  column.
- [x] 5.2 A change with no archived date is excluded and counted.
- [x] 5.3 The bucket boundaries: same day, exactly one day, exactly seven
  days, over a week.
- [x] 5.4 The source mix is reported, and a folder-name date is counted
  separately from a commit one.
- [x] 5.5 An empty set renders a sentence and no axes.
- [x] 5.6 The table carries the same numbers as the bars.

## 6. Verification

- [x] 6.1 `openspec validate --strict --changes`.
- [x] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged.
  Run 2026-09-09: exit 0 — 48 cli, 796 core, 302 extension, 68 server,
  338 webui.
- [x] 6.3 Version bump via `npx changeset` for `webui`.
- [x] 6.4 A screenshot captured by the browser suite, not by hand, over a
  fixture with enough changes to have a shape. The fixture is a git
  repository, because the charts read one: without commits every date is
  absent and the charts correctly draw nothing, which is a fine test and
  a useless picture.

  Looking at the first capture is what found two defects the tests could
  not: the lead-time labels overlapped into "3-7 daOver a wee", and the
  chart sat in a narrow strip of a wide box. The named buckets are rows
  now, with the label beside the bar.
- [x] 6.5 Run it over this repository's own 185 changes and record what
  the charts say — the same discipline the dates were built under.

  Run 2026-09-09:

  - **Archived per day**: 33 columns from 2026-08-08 to 2026-09-09, of
    which 19 carry something; busiest 2026-09-02 with 24. Nothing
    excluded, and all 179 dates came from a commit — the folder name
    answered nothing.
  - **How long a change took**: same day 125, one day 26, two days 9,
    three to seven 14, over a week 5. Nothing excluded.

  The buckets were sized before the chart existed, from median 0.22d and
  p90 3.14d, and they hold: the mass is in the first bucket without the
  rest collapsing into one bar.
