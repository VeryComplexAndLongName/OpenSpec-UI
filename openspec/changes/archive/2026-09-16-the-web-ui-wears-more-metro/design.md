## Context

ADR 0032 decided what this change and `the-web-ui-screens-wear-metro` carry
out between them. This one is the frame: the families, the icons and the
palette. No screen changes here.

The figures were measured on 2026-09-16 by running this repository's own
`build-metro.mjs` with each family added, against the vendored Metro 5.1.20:

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
- The four families are available to a screen, and look right in both hosts.
- An icon can be drawn from one pinned set, named by what it means, in a host
  that refuses another origin.
- A filled block that holds a label has a colour pair that passes WCAG AA.
- Everything here is checked by a test, so the work a person has to look at is
  separated out into the change that follows.

**Non-Goals:**
- **Screens.** Not one changes here; they are
  `the-web-ui-screens-wear-metro`.
- **Metro's layout language.** No tiles, app bar or side navigation
  (ADR 0030 decision 4).
- **`metro.js`.** React owns the DOM (ADR 0030 decision 3).
- **A second icon set.** One pinned set, one map from meaning to glyph.

## Decisions

### The kept-component list gains four names

`KEPT_COMPONENTS` becomes `button`, `input`, `select`, `textarea`, `table`,
`panel`, `card`, `badge`, `timeline`. The derived copy's byte count is asserted
by a test with a stated ceiling, so the next family to be added shows up as a
changed number in review rather than as silent growth.

`accordion` is measured at 134 bytes and is not carried: no screen needs one,
and a native `<details>` covers the only place that might.

Rejected: adding a family when a screen first needs it. The mapping of 18
variables and the size figure are one piece of work, and splitting it across
several screen changes would spread the same review over each of them.

### The icon subset is generated, pinned and inlined

A script reads the pinned Metro icon font and the map of glyphs this product
names, and writes a module holding one `@font-face` whose `src` is a `data:`
URI, plus one class per glyph. The project site's own subset is 3,684 bytes
for 24 glyphs, which is 4,912 characters of base64.

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

Rejected: an inline SVG set. It needs no font pipeline, but every icon becomes
code in the bundle, sized and coloured by hand, and drifts from the drawing
the project site uses.

### A colour token names the ink that goes with it

The shell's palette declares a hue together with the ink that passes AA on it.
Measured with white text, cobalt `#0048ad` at 8.3:1, indigo `#6500a8` at
9.9:1 and crimson `#dd0e37` at 5.0:1 pass. Green `#00b300` at 2.8:1, orange
`#ffa600` at 2.0:1, teal `#1ac7c7` at 2.1:1, emerald `#51c878` at 2.1:1,
amber `#ffc929` at 1.5:1 and steel `#7d92a6` at 3.2:1 do not, and carry dark
ink instead.

The project site writes white on all of them. This change takes its hues and
not that pairing.

Rejected: keeping the pairing implicit and relying on the axe run. axe sees
only the combinations a rendered page happens to show; a pair declared in the
palette is checked whether or not a screen uses it yet.

## Risks / Trade-offs

- **The bundles grow before anything uses the new CSS.** 7,793 bytes plus the
  icon font, in five bundles, for a change that alters no screen. The change
  that follows is what spends it, and splitting the two is what lets this one
  be judged by tests alone.
- **A mapping can be missed.** `vscode-metro-mapping.test.ts` fails on a
  variable the editor layer does not set, and the live check names the
  computed colours rather than asserting that a panel "looks right".
- **A Metro upgrade now re-runs two generators.** Both are pinned and both are
  checked against a fresh run.
