The web UI's controls become Metro UI's, scoped and built from a pinned source.
In VS Code they take the editor theme's colours; the standalone shell gains a
dark theme that follows the system.

## 1. The decision

- [x] 1.1 `docs/adr/0030-the-web-ui-uses-metro-components.md`: Metro's
  components without tiles, vendored and scoped, and themed by each host. It
  supersedes 0023's Metro rejection and keeps 0023's other decisions.

  Done, and approved by the owner on 2026-09-15 with the proposal.
- [x] 1.2 `docs/adr/README.md` gains the row, and 0023's row says that 0030
  supersedes its Metro rejection.

## 2. Metro, vendored and derived

- [x] 2.1 `packages/webui/vendor/metro/`: `metro.css` and `LICENSE` from
  `@olton/metroui@5.1.20`, and a `README` naming the version and the
  SHA-256. Record the hash and where the file was taken from.

  Done on 2026-09-15.
  - **Source.** `npm pack @olton/metroui@5.1.20`: `lib/metro.css` and
    `LICENSE` (MIT) from that tarball, unchanged. The owner chose to keep
    this file in the repository rather than only the derived copy.
  - **The file.** `metro.css` is 1,481,825 bytes, SHA-256
    `50e237f90becdbae2f216e97d84c2d3e35ef2bde1bbd1b69d2b24ed9c762c1f1`. It
    has no non-ASCII byte.
  - **The project site's copy** differs by one byte: its last line ends in
    CRLF, from `core.autocrlf` on Windows. So the root `.gitattributes`
    marks the vendored file `-text`. Checked out on Windows, the file keeps
    the hash above.
- [x] 2.2 `packages/webui/scripts/build-metro.mjs`: the pass of design
  decision 2, with `css-tree` declared as a development dependency. It writes
  `src/metro-css.generated.ts`, and an npm script runs it.

  Done. `css-tree ^3.2.1` is a devDependency of `@openspec-ui/webui`, and
  `npm run build:metro -w @openspec-ui/webui` runs the script.
  - **A narrower rule than the design's first wording.** The first rule kept
    any rule whose selector named a kept component's class anywhere. That
    carried other components that merely contain a button or an input: a
    colour picker, a spinner, a tag input, a rating, sortable columns. It
    came to 1661 rules and 221,032 bytes.
  - **The rule now.** A selector is kept only when every class it names is a
    kept component's or one of `KEPT_MODIFIERS`: a colour for an action or
    state (`primary`, `alert`, `success`, `warning`, `info`), `small`, and the
    states a control passes through. Beside a kept class, any element may
    appear (`.table td`, `.button-group>*`).
  - **Native controls.** Metro's rules on `button`, `input`, `select`,
    `textarea` and `table` are kept too. Without `metro.js` they are how Metro
    draws a native control. Its `.input`, `.select` and `.textarea` classes
    style the wrappers its script builds, as `display:flex; padding:0`, so
    on a bare `<input>` they break the field. `html` and `body` are never
    kept.
  - **The layer.** The copy is wrapped in `@layer metro`. The shell's
    unlayered rules (widths, layout) then win over Metro's scoped selectors,
    with no specificity race.
  - **`!important`.** It is stripped from every kept declaration: 55 of
    them. Inside a layer an important declaration beats every unlayered
    one, and Metro's primary and alert hover colours are literals written
    that way.
  - **Where it is written down.** ADR 0030 decision 2 carries these three
    points as an amendment dated 2026-09-15. So do design decision 2 and the
    spec delta, with a scenario for a native field keeping the shell's
    width.
- [x] 2.3 Tests:
  - the vendored file's hash;
  - the generated module matches a fresh run of the script;
  - no rule on a bare element, `*`, `html` or `body` survives;
  - every selector starts with `.openspec-metro`;
  - no `url(` to another origin.

  Done: `packages/webui/scripts/build-metro.test.mjs` has 8 tests, run by the
  package's `vitest run`. They check:
  - the hash;
  - the fresh run;
  - one `@layer metro` at the top;
  - scoping;
  - no selector but a kept component's or a native control's;
  - no `html` or `body`, and no `*` outside a kept component;
  - no `!important`;
  - no external `url(` or `@import`.

  Notes:
  - **Environment.** They run in Vitest's node environment.
  - **The script's `#!` line went.** Vitest failed on it when importing the
    script, and the npm script runs the file through `node` anyway.
  - **A `*` inside a kept component stays.** Examples are `.button-group>*`,
    `.dialog *+.dialog-content` and `*+.card`. It reaches only that
    component's children.
- [x] 2.4 Record the derived copy's size, and each kept component's rule
  count.

  **Build of 2026-09-15**, with native controls, the layer and no
  `!important`:
  - **Size.** 147,634 bytes: 1,048 rules, 101 light and 72 dark variables,
    and no keyframes. 65 rules on bare elements were dropped.
  - **Earlier builds.** The narrower class rule alone gave 132,319 bytes and
    1,024 rules. The first, broad rule gave 221,032 bytes and 1,661 rules.
  - **Selectors per component:** button 621, input 308, tabs 94, checkbox
    77, select 60, table 53, progress 52, textarea 51, badge 39, dialog 24,
    card 5 and panel 5.
  - **Selectors on native controls,** where no kept class is named: input
    252, button 20, textarea 19, select 16 and table 1. Most of the input
    count is the per-type lists `input[type=text],input[type=password],…`.
  - **Checks.** No selector falls outside `.openspec-metro`, and there is no
    `url(` and no `!important`.

  To be recorded again once 3.2 settles which modifiers the controls use.

## 3. The controls

- [x] 3.1 Each entry's root gains `openspec-metro` and injects the generated
  CSS before `shellThemeCss`.

  Done in the five entries: standalone, the AI panel, Harness Settings, the
  Pipeline and the Timeline.
  - **What changes on screen.** When 3.1 was first committed, nothing did:
    no `className` named a Metro class. Once 2.2 kept the native-control
    rules, every native button, field, select and textarea under the root
    takes Metro's look straight away. Wherever the shell's own unlayered
    rules set a property, theirs still wins.
  - **Checks.** webui typecheck and lint pass, and its tests pass: 52 files,
    477 tests.
  - **Line endings.** The root `.gitattributes` keeps
    `src/metro-css.generated.ts` in LF. A CRLF checkout would break the test
    that compares the module with a fresh run.
- [ ] 3.2 Buttons, inputs, selects, textareas, checkboxes, tables, tabs,
  dialogs, progress and badges take Metro's classes. Record per component how
  many places changed.
- [ ] 3.3 Remove each `openspec-*` rule that a Metro rule now does, rather
  than overriding it. Record which rules went.
- [ ] 3.4 Layout, the Pipeline picture, the dense forms' two-column rows and
  prose widths are unchanged. The unit tests that assert them still pass.

## 4. Themes

- [ ] 4.1 Standalone: the toggle in the header and the theme choice of
  design decision 5, with unit tests for no stored choice, a stored choice,
  a system change and unreadable storage.
- [ ] 4.2 VS Code: `vscodeThemeCss` sets every variable the generated copy
  reads, and `dark-side` follows `vscode-dark` and `vscode-high-contrast`. A
  test asserts every read variable is set.
- [ ] 4.3 Live check in the Extension Development Host, with pictures, in
  Default Dark Modern, Default Light Modern, Default High Contrast and one
  third-party theme: the AI panel, Harness Settings, the Pipeline and the
  Timeline. Record that each control's colours come from that theme.

## 5. Pictures and checks

- [ ] 5.1 The whole standalone browser suite passes. axe's WCAG AA run covers
  the standalone shell in light and in dark.
- [ ] 5.2 Every picture under `docs/images/` is retaken by its spec, from Bash
  for the editor pictures, and looked at.
- [ ] 5.3 A changeset: `@openspec-ui/webui` minor, `openspec-ui-vscode` minor,
  `@openspec-ui/server` patch.
- [ ] 5.4 `openspec validate the-web-ui-wears-metro --strict`, `lint:english`
  after `git add`, and `lint:screenshots` pass.
- [ ] 5.5 `npm run verify` passes, run unpiped. Record each package's count.
- [ ] 5.6 Live check of the standalone server in both themes, with a
  picture of the toggle.
