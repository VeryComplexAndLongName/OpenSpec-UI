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
    states a control passes through.
- [x] 2.3 Tests:
  - the vendored file's hash;
  - the generated module matches a fresh run of the script;
  - no rule on a bare element, `*`, `html` or `body` survives;
  - every selector starts with `.openspec-metro`;
  - no `url(` to another origin.

  Done: `packages/webui/scripts/build-metro.test.mjs`, 5 tests, run by the
  package's `vitest run`.
  - **Environment.** They run in Vitest's node environment.
  - **The script's `#!` line went.** Vitest failed on it when importing the
    script, and the npm script runs the file through `node` anyway.
  - **What counts as `*`.** A `*` inside a kept selector stays, as in
    `.button-group>*`, `.dialog *+.dialog-content` or `*+.card`. It reaches
    only that component's children. A selector whose only class is the root
    fails the bare-element test, and `html` and `body` may not appear at all.
- [x] 2.4 Record the derived copy's size, and each kept component's rule
  count.

  **First build with the narrower rule, 2026-09-15:**
  - **Size.** 132,319 bytes: 1,024 rules, 90 light and 64 dark variables,
    and no keyframes. 86 rules on bare elements were dropped.
  - **Selectors per component:** button 621, input 308, tabs 94, checkbox
    77, select 60, table 53, progress 52, textarea 51, badge 39, dialog 24,
    card 5 and panel 5.
  - **Checks.** No selector falls outside `.openspec-metro`, none names no
    class of its own, and no `url(`.

  To be recorded again once 3.2 settles which modifiers the controls use.

## 3. The controls

- [x] 3.1 Each entry's root gains `openspec-metro` and injects the generated
  CSS before `shellThemeCss`.

  Done in the five entries: standalone, the AI panel, Harness Settings, the
  Pipeline and the Timeline.
  - **Nothing changes on screen yet.** No `className` in webui names a bare
    Metro class or modifier, so no kept rule matches an element until 3.2.
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
