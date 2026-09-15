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

- **keeps** rules whose selectors name a class of a kept component, `:root`
  and `.dark-side` variable blocks for those components and the base
  palette, and the `@keyframes` those rules name;
  - **The kept components** are a list in the script. It started from
    Metro's `button`, `input`, `select`, `textarea`, `checkbox`, `table`,
    `tabs`, `dialog`, `progress`, `badge`, `panel` and `card`.
  - **Task 3.2 cut it** to `button`, `input`, `select`, `textarea` and
    `table`. The others style DOM that `metro.js` builds, or a
    fixed-position modal, or nothing on screen uses them;
- **keeps** Metro's rules on the native fields `input`, `select`,
  `textarea` and `table`. Without `metro.js` these are how Metro draws a
  native field. Its `.input`, `.select` and `.textarea` classes are for the
  wrappers its script builds (`display:flex; padding:0`), and on a native
  field they break it. Its bare `button` rule is not kept. The web UI
  renders list rows, tree nodes and links as buttons, and that rule gave
  each one a grey fill and a 36px height. An action takes the `button`
  class instead;
- **drops** every other rule whose selector is a bare element, `*` outside a
  kept component, `html` or `body`;
- **scopes** each kept selector under `.openspec-metro`, and rewrites `:root`
  and `.dark-side` as `.openspec-metro` and `.openspec-metro.dark-side`;
- **wraps** the copy in `@layer metro`. An unlayered rule wins over a layered
  one whatever their specificity, so the shell's widths and layout (0023)
  hold against Metro's scoped selectors with no `!important` and no
  specificity race;
- **strips `!important`** from every kept declaration. Inside a layer an
  important declaration beats every unlayered one. Metro's
  `.button.primary:hover` and `.button.alert:hover` set literal colours that
  way, and they would override the VS Code mapping of decision 6.

The native-control rules and the layer were settled while implementing
2.2, after the first build put a bare `<input>` under Metro's wrapper rule.
ADR 0030 decision 2 carries the amendment.

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

Native fields, selects, textareas and checkboxes take Metro's look with no
class of their own, from the native-field rules of decision 2. The classes
added are:
- `button` on each action;
- `button primary` on the one primary action of a form;
- `button alert` on an action that stops or discards;
- `table` on a table;
- `badge` on a count.

Buttons that are list rows, tree nodes, links, tabs or a Pipeline card's own
controls take no Metro class. They keep the shell's styling, and the
Pipeline card keeps its measured geometry. Tabs keep their ARIA structure.

**What an action's colour is** — the primary action, a destructive one, a
state — does not come from Metro's colour classes.
- **They are colour utilities, not component rules,** and their values are
  literal and `!important`:
  `.primary{background-color:#f75553!important;color:#fff!important}`.
- **White on that red is 3.3:1,** which fails the AA gate of ADR 0030
  decision 6.
- **Its `.button.primary:hover` is the same red,** so a teal button would
  turn red under the pointer.

So the build keeps none of them (decision 2), and the shell colours
`primary` and `alert` buttons from its own tokens: 0023's measured palette
standalone, and the editor theme in VS Code. Metro supplies a control's
shape, size, states and neutral component colours. The accent and the
states stay the shell's.

Existing `openspec-*` classes stay for layout, which Metro does not provide.
Because Metro sits in a layer, an `openspec-*` rule wins wherever both set a
property. Such a rule that only repeats a look Metro now draws is removed
(task 3.3). Two rules fighting over one property is how 0023's patchy look
began.

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
