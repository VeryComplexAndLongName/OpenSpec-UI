## Why

ADR 0032. The web UI carries five Metro families today — `button`, `input`,
`select`, `textarea`, `table` — and draws everything else itself. It has no
icons at all, only the owl logo and Unicode markers.

The owner asked for the project site's use of Metro UI 5.1 to reach the web UI.
That needs a frame before it needs screens: the families themselves, an icon
set, and a palette whose colours are safe to fill a block with. This change is
that frame. The screens follow in `the-web-ui-screens-wear-metro`, which is
blocked by this one, so that the parts that can be checked by a test land
before the parts that have to be looked at.

## What Changes

- **Four Metro families join the derived copy:** `panel`, `card`, `badge` and
  `timeline`. Measured against the pinned 5.1.20: 7,793 bytes and 18 new
  variables, each of which gains a VS Code mapping.
- **The derived copy's size is stated and checked**, so a later family cannot
  be added without the figure changing in review.
- **Icons ship as a subset font**, built by a script in this repository from
  the pinned Metro icon set and inlined as a `data:` URI, because the
  standalone server serves fixed paths and a webview's CSP refuses another
  origin. A map turns what the product means into a glyph, and an `Icon`
  component draws one beside a label without entering the accessible name.
- **A hue is declared with the ink it carries.** White on cobalt, indigo and
  crimson; dark ink on green, orange, teal, emerald, amber and steel. A test
  computes the contrast of every declared pair.
- **Nothing on screen changes yet.** No screen adopts a panel, a card, a badge
  or an icon in this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-ui`: the derived copy carries the four families and states its size;
  a colour token names the ink that goes with it; the shell draws icons from
  one pinned, inlined set.

## Impact

- **`packages/webui`**
  - `scripts/build-metro.mjs`: the kept-component list;
  - `scripts/build-metro-icons.mjs` and `vendor/metro-icons/`, both new;
  - `src/metro-css.generated.ts` and `src/metro-icons.generated.ts`;
  - `src/icons.ts` and `src/components/Icon.tsx`, both new;
  - `src/shell-ui.ts`: the hue-and-ink pairs, and the VS Code mapping of the
    18 new variables.
- **`packages/extension`**: nothing but the bundles it rebuilds, which grow by
  the same CSS.
- **Unchanged**: every screen, the Pipeline picture, the change editor, diffs
  and the AI panel.
