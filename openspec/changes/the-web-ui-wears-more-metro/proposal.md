## Why

ADR 0032. The web UI carries five Metro families today — `button`, `input`,
`select`, `textarea`, `table` — and draws everything else itself: panels, two
kinds of card, timeline rails, tab strips. It has no icons at all, only the owl
logo and Unicode markers.

The owner asked for the project site's use of Metro UI 5.1 to reach the web UI:
settings as panels with a heading and an icon on the left, a summary and a
timeline closer to the site's, icons for orientation, and the site's hues in
the standalone shell.

## What Changes

- **Four Metro families join the derived copy:** `panel`, `card`, `badge` and
  `timeline`. Measured against the pinned 5.1.20: 7,793 bytes and 18 new
  variables, each of which gains a VS Code mapping.
- **Icons ship as a subset font**, built by a script in this repository from
  the pinned Metro icon set and inlined as a `data:` URI, because the
  standalone server serves fixed paths and a webview's CSP refuses another
  origin. A map turns what the product means into a glyph.
- **Screens change.**
  - **Harness Settings** becomes Metro panels, each with its name and an icon
    in `.panel-title`, keeping the two-column name-and-value rows inside.
  - **The Timeline tab's per-change view** becomes Metro's `.timeline`.
  - **The Timeline tab's multi-change view** takes the shape of the site's
    Release History — a sticky change column, a day axis, events placed by
    `grid-column` — as the shell's own CSS, since Metro has no such component.
  - **OpenSpec view summary** gains tiles with an icon block on the left, and
    state words become badges.
  - **Repeated actions carry an icon:** start, stop, refresh, review, archive,
    open.
- **A hue is declared with the ink it carries.** White on cobalt, indigo and
  crimson; dark ink on green, orange, teal, emerald, amber and steel. The
  shell's palette gains those pairs; the editor keeps taking its own theme.
- **A budget is recorded and pinned** for the derived copy's size, so a later
  family cannot be added without the figure changing in review.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-ui`: the derived copy carries the four families and a pinned icon
  set; a colour token names the ink that goes with it; a card is allowed where
  a block is a separate object.

## Impact

- **`packages/webui`**
  - `scripts/build-metro.mjs`: the kept-component list, and the one
    `@font-face` exception for the icon subset;
  - a new `scripts/build-metro-icons.mjs` and the vendored icon source;
  - `src/metro-css.generated.ts` and a new generated icons module;
  - `src/shell-ui.ts`: the palette pairs, the VS Code mapping of 18 variables,
    the history grid, and the removal of the rules the Metro families replace;
  - `src/components/`: `GlobalHarnessSettingsView`, `ChangeHarnessSettingsView`,
    `ChangeTimelineView`, `MultiChangeTimelineView`, the summary blocks of
    `standalone-entry`, and the buttons that gain an icon.
- **`packages/extension`**: nothing but the bundles it rebuilds, which grow by
  the same CSS.
- **Unchanged**: the Pipeline picture (ADR 0025, 0029), the change editor,
  diffs and the AI panel.
