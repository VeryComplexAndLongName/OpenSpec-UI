## Context

ADR 0032 decided what this change carries out. The figures it records were
measured on 2026-09-16 by running this repository's own `build-metro.mjs` with
each family added, against the vendored Metro 5.1.20:

| Variant | Rules | Bytes | Added | New variables |
| --- | --- | --- | --- | --- |
| today | 732 | 112,595 | — | — |
| `panel` | 736 | 113,758 | 1,163 | 6 |
| `card` | 741 | 114,547 | 1,952 | 8 |
| `badge` | 773 | 116,550 | 3,955 | 3 |
| `timeline` | 738 | 113,318 | 723 | 1 |
| all four | 792 | 120,388 | 7,793 | 18 |

## Goals / Non-Goals

**Goals:**
- A screen that is a form reads as sections, each named, with an icon that
  says what the section is about.
- A change's history reads as a timeline, and several changes read as one
  picture over a single axis of time.
- A person can find an action by its icon before reading its word.
- Every colour on screen still passes WCAG AA in both standalone themes, and
  the editor's own theme still owns the hosted panels.

**Non-Goals:**
- **Metro's layout language.** No tiles, app bar or side navigation
  (ADR 0030 decision 4).
- **`metro.js`.** React owns the DOM (ADR 0030 decision 3).
- **A second icon set.** One pinned set, one map from meaning to glyph.
- **The Pipeline picture.** It is derived and drawn by hand (ADR 0025).

## Decisions

### The kept-component list gains four names

`KEPT_COMPONENTS` becomes `button`, `input`, `select`, `textarea`, `table`,
`panel`, `card`, `badge`, `timeline`. The derived copy's byte count is asserted
by a test with a stated ceiling, so the next family to be added shows up as a
changed number in review rather than as silent growth.

`accordion` is measured at 134 bytes and is not carried: no screen needs one,
and a native `<details>` covers the only place that might.

### The icon subset is generated, pinned and inlined

A script reads the pinned Metro icon font and the map of glyphs this product
names, and writes a module holding one `@font-face` whose `src` is a `data:`
URI, plus one class per glyph. The project site's subset is 3,684 bytes for 24
glyphs, which is 4,912 characters of base64; this one is sized by its own map.

- **Why a subset and not the whole icon font.** Metro's icon stylesheet is
  384 KB.
- **Why inlined.** `packages/server`'s static handler serves three fixed paths,
  and a VS Code webview's CSP refuses a font from another origin. The owl logo
  is inlined for the same reason.
- **The build script's one exception.** `build-metro.mjs` still drops every
  `@font-face` it finds in `metro.css`; the icon face comes from the subset
  build, never from that file.
- **A glyph is named for its meaning.** `iconFor("change")`, not
  `mif-git-compare`, so a screen states a concept and the map holds the
  drawing.

### A colour token names the ink that goes with it

The shell's palette declares a hue together with the ink that passes AA on it.
Measured with white text: cobalt #0048ad 8.3:1, indigo #6500a8 9.9:1, crimson
#dd0e37 5.0:1 pass; green #00b300 2.8:1, orange #ffa600 2.0:1, teal #1ac7c7
2.1:1, emerald #51c878 2.1:1, amber #ffc929 1.5:1 and steel #7d92a6 3.2:1 do
not, and carry dark ink instead.

The project site writes white on all of them. This change takes its hues and
not that pairing.

### Screen by screen

- **Harness Settings.** Each `openspec-harness-section` becomes a `.panel`
  whose `.panel-title` holds the section's name and, in the title's left icon
  slot, its icon. The stage rows and the two-column fields inside are
  unchanged.
- **Per-change timeline.** `ChangeTimelineView`'s task rail becomes a
  `.timeline`: one `li` per task, the date in `.time`, the text in `.data`, the
  dot Metro's own. The expand-on-click detail stays.
- **Multi-change timeline.** `MultiChangeTimelineView` becomes a grid: a
  sticky first column naming the change, a day axis along the top, and one
  block per event placed by `grid-column`. It replaces the log-scaled lanes,
  whose position no reader could translate back into a date.
- **Summary.** The counts at the top of the overview tab become tiles: a
  coloured square with an icon, then a label and a figure. A change's state
  word becomes a `.badge`.
- **Buttons.** An action that repeats across screens carries its icon before
  its label: start, stop, refresh, review, archive, open.

### What the shell's own CSS loses

`openspec-shell-panel`'s section styling, the status and data card rules, and
the timeline rail rules give way to the Metro families. `shell-ui.ts` keeps the
frame, the forms, the palette, the pipeline picture and the new history grid.

## Risks / Trade-offs

- **Two ways to draw a card** until the shell's own card classes are retired.
  The tasks name which screens move, and the rules that go with them.
- **The hosted panels can look foreign** if a mapping is missed. The existing
  parity test fails on a missing variable, and the live check covers a dark
  and a high-contrast editor theme.
- **An icon can say less than a word.** Every icon sits beside its label, and
  none is the only carrier of meaning; `aria-hidden` on each keeps it out of
  the accessible name.
- **A Metro upgrade now re-runs two generators.** Both are pinned and both are
  checked against a fresh run.
