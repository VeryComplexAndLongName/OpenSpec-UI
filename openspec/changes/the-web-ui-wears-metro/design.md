# Design: the web UI wears Metro

## Context

Measured on 2026-09-15, against `main` at 7c9644c.

**The web UI**
- **Source.** 68 non-test source files, 391 `className=` attributes and 194
  distinct `openspec-*` classes. `shell-ui.ts` holds 287 rule blocks, with a
  single colour literal outside `:root`.
- **What it renders:** 74 buttons in 20 files, 20 inputs, 19 selects, 29
  labels, 15 `pre`/`code` blocks, 4 tables, 4 dialogs, 2 tab lists, 2
  `details`, and one each of progress, checkbox and textarea. There are 3
  inline SVGs and no icon font.
- **Where the shell styles go.** Five entries carry them:
  `standalone-entry.tsx`, `extension-entry.tsx`, `harness-settings-entry.tsx`,
  `pipeline-entry.tsx` and `timeline-entry.tsx`. Each injects
  `<style>{shellThemeCss}</style>`, and the four VS Code ones add
  `vscodeThemeCss`.
- **The gates.** `shell-ui.test.ts` asserts that every `:root` token of the
  shell layer is defined by the VS Code layer, and that no rule outside
  `:root` holds a colour literal.

**Metro UI 5.1.20**, the latest release of `@olton/metroui`
- **Size.** `metro.css` is 1,481,826 bytes.
- **Variables.** 1,104 in 142 `:root` blocks, and 626 in 112 `.dark-side`
  blocks. Most components declare their own, often as literal colours.
- **The components this change uses** declare about 200 light variables:
  button 8, input 23, select 24, textarea 4, checkbox 6, table 21, tabs 19,
  dialog 8, progress 10, badge 3, panel 9 and card 9.
- **About 434 rules on bare elements,** among them
  `*{margin:0;padding:0;box-sizing:border-box}` and
  `body{display:flex;flex-direction:column;min-height:100vh}`.

**The CSS tooling.** `css-tree` 3.2.1 and `postcss` 8.5.25 are in
`node_modules`, but only through `jsdom` and `vite`.

## Goals / Non-Goals

**Goals**
- The web UI's controls are Metro's, in both hosts.
- In VS Code, every Metro colour the UI draws comes from the active theme,
  built-in or not, including high contrast.
- The standalone shell has a light and a dark theme, following the system,
  with a remembered toggle.
- Nothing is fetched from another origin; a webview's CSP needs no change.

**Non-Goals**
- Tiles, app bar, side navigation; `metro.js`; Metro's icon font.
- Changing what any screen says or does.

## Decisions

### 1. Vendor the published file, pinned

`packages/webui/vendor/metro/metro.css` and `LICENSE` come from
`@olton/metroui@5.1.20` (`lib/metro.css`). A `README` beside them records the
version and the SHA-256 of `metro.css`. A test recomputes the hash, so an
edited vendor file cannot pass as the published one.

Rejected: **depending on the npm package at build time.** It would add a
runtime-shaped dependency for a file that changes only when a person decides
to upgrade, and would put the upgrade in a lockfile diff nobody reads.

### 2. Derive the shipped copy with one script

`packages/webui/scripts/build-metro.mjs` reads the vendored file with
`css-tree`, declared as a direct development dependency of
`@openspec-ui/webui`. It writes `packages/webui/src/metro-css.generated.ts`,
exporting one string. The pass:

- **keeps** rules whose selectors name a class of a kept component (a list in
  the script, starting from Metro's `button`, `input`, `select`, `textarea`,
  `checkbox`, `table`, `tabs`, `dialog`, `progress`, `badge`, `panel` and
  `card`), `:root` and `.dark-side` variable blocks for those components and
  the base palette, and the `@keyframes` those rules name;
- **drops** every rule whose selector is a bare element, `*`, `html` or
  `body`;
- **scopes** each kept selector under `.openspec-metro`, and rewrites `:root`
  and `.dark-side` as `.openspec-metro` and `.openspec-metro.dark-side`.

The generated module is committed, and a test runs the script and asserts
the output is unchanged. A forgotten rebuild fails there, not in a picture.

Rejected:
- **A LESS rebuild of Metro**, which is the reason the project site gave for
  not scoping.
- **`postcss-prefix-selector` with PurgeCSS**: two new dependencies for what
  one walk over one parsed file does.

### 3. One root, set by each entry

Each entry's top element gains `openspec-metro`. The standalone shell sets
`dark-side` on it from the theme choice (decision 5). VS Code webviews set it
from the body class the editor adds.

### 4. The controls take Metro's classes

For example, `button` gains `button`, the primary action `button primary`, and
a text field `input`. Tabs keep their ARIA structure and take `tabs` classes.
Existing `openspec-*` classes stay for layout, which Metro does not provide.
Where a Metro rule and an `openspec-*` rule disagree on spacing, the
`openspec-*` rule is removed, not overridden: two rules fighting over one
property is how 0023's patchy look began.

### 5. The standalone theme: system first, then the person's choice

On load, a stored choice wins. Otherwise
`matchMedia("(prefers-color-scheme: dark)")` decides, and a change to it is
followed while no choice is stored. The header toggle stores `light` or
`dark` in `localStorage` under `openspec-ui.theme`. Storage that cannot be
read or written falls back to the system preference, and never throws.

### 6. VS Code: map Metro's variables onto the theme

`vscodeThemeCss` gains a `.openspec-metro` block that sets each variable the
generated copy reads:
- **Grounds, text and borders** from `--vscode-editor-*`, `--vscode-sideBar-*`
  and `--vscode-panel-border`.
- **Controls** from `--vscode-button-*`, `--vscode-input-*`,
  `--vscode-dropdown-*`, `--vscode-checkbox-*` and `--vscode-focusBorder`.
- **States** from `--vscode-charts-green`, `-yellow`, `-red` and `-blue`, with
  `color-mix()` against the editor background for tinted grounds.

`body.vscode-dark` and `body.vscode-high-contrast` put `dark-side` on the
root, so any variable the mapping leaves unset falls back to Metro's dark
value rather than its light one.

A test collects every `var(--…)` the generated copy reads, and every variable
its kept blocks declare, and asserts the VS Code layer sets each one.

## Risks / Trade-offs

- **The kept-component list** is maintained by hand. A control given a Metro
  class whose component is not kept renders unstyled. The browser suite's
  pictures and axe catch it; the list is the one place to add it.
- **Metro's variables are not all named for their purpose,** unlike 0023's
  tokens. The mapping layer is where they are given one, one line each.
- **Some bundle weight.** The derived copy's size is recorded when it is first
  built. It is carried once per bundle.
- **High-contrast themes** set borders where Metro sets none. The mapping sets
  `--border-color` from `--vscode-contrastBorder` where it is defined.
