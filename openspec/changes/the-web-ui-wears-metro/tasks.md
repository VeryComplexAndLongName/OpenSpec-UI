The web UI's controls become Metro UI's, scoped and built from a pinned source.
In VS Code they take the editor theme's colours; the standalone shell gains a
dark theme that follows the system.

## 1. The decision

- [ ] 1.1 `docs/adr/0030-the-web-ui-uses-metro-components.md`: Metro's
  components without tiles, vendored and scoped, and themed by each host. It
  supersedes 0023's Metro rejection and keeps 0023's other decisions.
- [ ] 1.2 `docs/adr/README.md` gains the row, and 0023's row says that 0030
  supersedes its Metro rejection.

## 2. Metro, vendored and derived

- [ ] 2.1 `packages/webui/vendor/metro/`: `metro.css` and `LICENSE` from
  `@olton/metroui@5.1.20`, and a `README` naming the version and the
  SHA-256. Record the hash and where the file was taken from.
- [ ] 2.2 `packages/webui/scripts/build-metro.mjs`: the pass of design
  decision 2, with `css-tree` declared as a development dependency. It writes
  `src/metro-css.generated.ts`, and an npm script runs it.
- [ ] 2.3 Tests:
  - the vendored file's hash;
  - the generated module matches a fresh run of the script;
  - no rule on a bare element, `*`, `html` or `body` survives;
  - every selector starts with `.openspec-metro`;
  - no `url(` to another origin.
- [ ] 2.4 Record the derived copy's size, and each kept component's rule
  count.

## 3. The controls

- [ ] 3.1 Each entry's root gains `openspec-metro` and injects the generated
  CSS before `shellThemeCss`.
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
