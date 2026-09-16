# 0032: The Standalone Shell Uses More of Metro: Panels, Badges, a Timeline and Icons

Status: Proposed

Date: 2026-09-16

Extends [0030](0030-the-web-ui-uses-metro-components.md), which brought Metro's
controls in, and amends decisions 1 and 2 of
[0023](0023-standalone-shell-visual-direction.md), which ruled out cards.

## Context

The owner asked for the web UI to use more of Metro UI 5.1, the way the
project site `OpenSpec-UI-Homepage` does, naming Harness Settings as panels
with a heading on the left, the summary and Timeline screens as something
closer to the site's Release History, icons for orientation, buttons that
carry an icon, and the site's colours for the standalone shell only.

**What the web UI ships today.** ADR 0030's derived copy carries five families
— `button`, `input`, `select`, `textarea`, `table` — as 732 rules and 112,595
bytes, scoped under `.openspec-metro` in `@layer metro`, with Metro's colour
classes dropped and `!important` stripped. `metro.js` is not used. The copy is
inlined into all five bundles (the standalone shell and four VS Code
webviews). Everything else on screen is the shell's own CSS: `shell-ui.ts` is
2,114 lines, and it already hand-draws panels (`openspec-shell-panel`), two
kinds of card (`openspec-status-card`, `openspec-data-card`), two tab strips,
the timeline rails and the pipeline nodes.

**The web UI has no icons at all.** The only image is the owl logo, a base64
PNG. Markers are Unicode characters: `▾ ● ○ ◌ ⚠ ▶ ■`.

**What the site actually does**, read on 2026-09-16:

- **It vendors Metro whole** (1,447 KB) plus a generated icon subset:
  `icons.css` 1,431 bytes and `icons-subset.woff2` 3,684 bytes for 24 glyphs,
  cut by `tools/subset_metro_icons.py` from Metro 5.1.20. Nothing from a CDN,
  and no `metro.js`.
- **It uses little of Metro.** The `skill-box` card, `button`, `badge inline`,
  `table row-hover`, the `bg-*`/`fg-white` colour classes, the `mif-*` icons
  and `.dark-side`. Its tabs, panels, accordion and charts are its own.
- **Release History is not Metro.** It is a CSS grid of about 55 lines, with a
  sticky product column, a day axis, and events placed by `grid-column`.
  Metro's own `.timeline` is a different thing: a `ul` whose `li` carries
  `.time` and `.data`, with a dot and a line drawn by `:before`/`:after`.
- **Its colours would fail this project's gate.** The site writes white on
  Metro's palette classes. Measured: `bg-green` #00b300 with white is 2.8:1,
  `bg-orange` #ffa600 is 2.0:1, `bg-teal` #1ac7c7 is 2.1:1, `bg-emerald`
  #51c878 is 2.1:1, `bg-amber` #ffc929 is 1.5:1, `bg-steel` #7d92a6 is 3.2:1.
  Only `bg-cobalt` #0048ad at 8.3:1, `bg-indigo` #6500a8 at 9.9:1 and
  `bg-crimson` #dd0e37 at 5.0:1 carry white text at WCAG AA.

**What the four families would cost.** Measured on 2026-09-16 by running this
repository's own `build-metro.mjs` with each family added, against the pinned
Metro 5.1.20:

| Variant | Rules | Bytes | Added | New variables |
| --- | --- | --- | --- | --- |
| today | 732 | 112,595 | — | — |
| `panel` | 736 | 113,758 | 1,163 | 6 |
| `card` | 741 | 114,547 | 1,952 | 8 |
| `badge` | 773 | 116,550 | 3,955 | 3 |
| `timeline` | 738 | 113,318 | 723 | 1 |
| `accordion` | 733 | 112,729 | 134 | 0 |
| all four | 792 | 120,388 | 7,793 | 18 |

## Decision

1. **Four more families join the derived copy: `panel`, `card`, `badge` and
   `timeline`.** That is one line in `build-metro.mjs`'s `KEPT_COMPONENTS`,
   and it costs 7,793 bytes in each of the five bundles, 6.9% more Metro.
   - **Why these.** Each is plain CSS that React can render: `panel` has a
     `.panel-title` with a left icon slot, `card` has a header, content and
     footer, `badge` is one span, and `timeline` is a list. None needs
     `metro.js`.
   - **`accordion` is not carried.** It costs almost nothing, but no screen
     needs one: the FAQ pattern it serves does not exist here, and a native
     `<details>` covers the one place that might.
   - **The budget is recorded.** The change that implements this states the
     measured size, and a test pins it, so a later family cannot be added
     without the figure changing in review.

2. **Every variable the new families read gains a VS Code mapping.** The 18
   are `--panel-background`, `--panel-color`, `--panel-border-color`,
   `--panel-border-radius`, `--panel-header-background`,
   `--panel-header-color`, `--card-background`, `--card-color`,
   `--card-border-radius`, `--card-header-background`, `--card-header-color`,
   `--card-footer-background`, `--card-footer-color`,
   `--card-button-border-color`, `--badge-background`, `--badge-color`,
   `--badge-border-radius` and `--timeline-marker-color`. They map to the
   editor's own tokens, as ADR 0023 decision 4 requires, and
   `vscode-metro-mapping.test.ts` already fails when one is missing.

3. **Icons ship as a subset font, inlined.** A generated stylesheet carries
   one `@font-face` whose `src` is a `data:` URI of a `woff2` subset, pinned
   to Metro 5.1.20 and built by a script in this repository, the way the site
   builds its own. The site's 24 glyphs are 3,684 bytes, which is 4,912
   characters of base64.
   - **Why inlined.** The standalone server serves three fixed paths, and a VS
     Code webview's CSP refuses a font from anywhere else. The existing owl
     logo is inlined for the same reason.
   - **The build script's rule changes by exactly one exception.** It drops
     every `@font-face` from Metro's stylesheet, and keeps carrying nothing
     from it; the icon face comes from the subset build, not from `metro.css`.
   - **A glyph is named once.** A small map from what the product means
     (a change, a spec, an archive, a run, a stop, a task, a warning) to a
     glyph, so a screen names a concept and not a picture.

4. **Screens use them as follows.**
   - **Harness Settings** becomes Metro panels, one per section, each with its
     name in `.panel-title` and an icon in that title's left slot. ADR 0023's
     two-column name-and-value rows stay inside the panel.
   - **The Timeline tab's per-change view** becomes Metro's `.timeline`: the
     date in `.time`, the task in `.data`, the marker Metro's dot.
   - **The Timeline tab's multi-change view** takes the site's Release History
     shape — a sticky change column, a day axis, and event blocks placed by
     `grid-column` — written as the shell's own CSS, because Metro has no
     such component. It replaces today's log-scaled lanes.
   - **OpenSpec view summary** gains tiles in the site's `.os-kpi` shape: a
     coloured square holding an icon on the left, a label and a figure on the
     right. State words become `badge`s.
   - **Repeated actions carry an icon**: start, stop, refresh, review,
     archive, open.
   - **Nothing else changes.** The Pipeline picture stays as ADR 0025 and 0029
     drew it, and the change editor, diffs and the AI panel keep their look.

5. **ADR 0023 decisions 1 and 2 are amended.** A card is allowed where a block
   is genuinely a separate object — a settings section, a summary tile — and
   is still refused for a list row, a heading or a tab strip. Decision 2's
   rule stands and is what decides: separation is spent by role. The reason
   0023 rejected Metro was tiles as a layout language, which this ADR does not
   bring in either (ADR 0030 decision 4).

6. **Colour: the standalone shell may take the site's hues, bound to a text
   colour that passes AA.** A hue is declared with the ink it carries, and the
   pair is what a screen uses. White text is allowed on cobalt, indigo and
   crimson; green, orange, teal, emerald, amber and steel carry dark text.
   Metro's own colour classes stay out of the copy, as ADR 0030 decision 5
   already ruled.
   - **VS Code is untouched.** Its panels keep taking every colour from the
     editor's theme.
   - **Contrast stays a gate.** The browser suite's axe run covers WCAG AA in
     both themes of the standalone shell, and a new pair that fails there is
     not shipped.

## Consequences

- **Each bundle grows by 7,793 bytes of CSS plus about 6 KB of inlined font.**
  Against today's 2.0 MB standalone bundle that is 0.4% for the CSS and 0.7%
  with the font; against the 4.7 MB extension bundle, 0.2% and 0.3%.
- **The shell's own CSS shrinks** where a hand-written panel or card is
  replaced, and grows by the history grid.
- **An upgrade of Metro re-runs two generators**, the CSS cut and the icon
  subset, both pinned and both checked by a test against a fresh run.
- **A screen that adopts a card now has two ways to draw one**, Metro's and
  the shell's, until the shell's own card classes are retired. The change that
  implements this says which screens move and which classes go.

## Rejected Alternatives

### Vendoring `metro.css` whole, as the site does

1,447 KB in five bundles, and hundreds of rules on bare elements restyling
pages Metro does not own. ADR 0030 rejected this and the reason has not
changed: the site serves pages it controls end to end, and the web UI runs
inside another product's windows.

### Using Metro's `bg-*` and `fg-white` classes, as the site does

They are literal colours marked `!important`, and six of the eleven the site
uses fail WCAG AA with white text, as measured above. Adopting them would
either ship that failure or fight it rule by rule.

### Metro's `streamer` for the multi-change view

Metro's timeline-like component for a horizontal feed is 238 KB and empty
without `metro.js`, which ADR 0030 decision 3 refuses. The site rejected it
for the same reason and wrote a grid instead.

### An inline SVG icon set instead of a font

It needs no font pipeline and no `@font-face` exception, but every icon is
then code in the bundle, sized and coloured by hand, and the set drifts from
the site's. The subset font is 3,684 bytes for 24 glyphs and gives both
surfaces the same drawing.

### Icons or CSS from a CDN

Refused by the owner's standing constraint, and by the privacy and outage
reasons the site recorded when it vendored Metro.
