The second step of ADR 0033's delivery order: the frame and the shared
components. The reference is the approved mockup,
https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L.

## 1. The palette

- [x] 1.1 `shellThemeCss`'s light `:root` in `packages/webui/src/shell-ui.ts`
  takes the site's values under the existing token names, adds `--heading`,
  `--link` and `--tab-accent`, sets `--muted` to `#646a74`, and the
  coloured-block hues to cobalt `#0050ef`, indigo `#6a00ff`, steel `#647687`
  and emerald `#008a00` with white ink.
- [x] 1.2 The dark `:root[data-openspec-theme="dark"]` block takes the site's
  dark values under the same names.
- [x] 1.3 `vscodeThemeCss` maps `--heading`, `--link` and `--tab-accent` onto
  the editor's variables.
- [x] 1.4 `packages/webui/src/shell-ui.test.ts` asserts the three new tokens
  exist in both palettes and the VS Code layer, and that `--muted` passes
  4.5:1 on `--surface` and `--bg` in both themes.

  Done on 2026-09-16. The light and dark palettes take the site's values
  under the existing names, so every rule took the new colours without being
  rewritten. Measured before writing: every text token passes 4.5:1 on every
  ground of its theme, and `--link` is the site's `#0a6ebd` one step darker,
  `#0963ad`, since the site's value read 4.42:1 on the footer.
  - **Checks:** `shell-ui.test.ts` and `vscode-metro-mapping.test.ts` pass.

## 2. The frame

- [x] 2.1 `packages/webui/src/components/AppBar.tsx` renders the owl, "OpenSpec
  UI" as text, the workspace path it is given, and `ThemeToggle`.
- [x] 2.2 `packages/webui/src/page-heads.ts` exports `PAGE_HEADS`, a tagline,
  an icon meaning, a title and a sentence for each tab id of `ALL_TABS`.
- [x] 2.3 `packages/webui/src/components/PageHead.tsx` renders the tagline with
  its icon, the `h1` title and the sentence.
- [x] 2.4 `TabDefinition` in `packages/webui/src/components/Tabs.tsx` gains
  `short`; `Tabs` shows it and sets the full label as `aria-label`.
- [x] 2.5 `ALL_TABS` in `packages/webui/src/host-embed.ts` gives each tab its
  short label: Run, Processes, Diff, Summary, Editor, Templates, Timeline,
  Pipeline, Harness.
- [x] 2.6 `packages/webui/src/standalone-entry.tsx` renders `AppBar` across the
  page, then a page of `PageHead`, `Tabs` and the tab panels, then a footer
  with the versions; each tab panel's `h2` and its first note go.
- [x] 2.7 `shellThemeCss` draws `.openspec-app-bar`, `.openspec-page`,
  `.openspec-page-head`, the tab row as an underlined bar, and
  `.openspec-app-footer`, at the mockup's sizes.
- [x] 2.8 Tests: `AppBar.test.tsx` (the name is not a heading, the path and
  the switch are there), `PageHead.test.tsx` (one `h1`, the tagline, the
  sentence), `page-heads.test.ts` (a head for every tab id of `ALL_TABS`),
  `Tabs.test.tsx` (the short label shown, the full name kept, the short one
  part of it), `host-embed.test.ts` (the short labels).

  Done on 2026-09-16, with two deviations. The VS Code local-server embed
  of the standalone entry shows neither the application bar nor the page
  head, since ADR 0033 gives the frame to the standalone shell alone. And
  the short labels are asserted in `Tabs.test.tsx`, against `ALL_TABS`
  itself, rather than in `host-embed.test.ts`: the one test reads each
  label, its short form, and that the short form is words of the full name.
  - **Checks:** `AppBar.test.tsx` 2, `PageHead.test.tsx` 1,
    `page-heads.test.ts` 2 and `Tabs.test.tsx` 12 pass; webui typecheck and
    lint pass.

## 3. The shared components

- [x] 3.1 `shellThemeCss` draws `.openspec-panel` with `-head`, `-body` and
  `-fine`, `.openspec-tile` with `-icon` and `-text`, `.openspec-table`,
  `.openspec-segmented`, `.openspec-controls` and `.openspec-notice`, from
  tokens only.
- [x] 3.2 `.openspec-shell-panel` and the summary's `.openspec-overview-tile*`
  take the panel's and the tile's look.
- [x] 3.3 `packages/webui/src/shell-ui.test.ts` asserts each component rule
  exists and reads no literal colour.

  Done on 2026-09-16. The summary's tiles take the site's KPI shape — an
  84-pixel coloured block holding the icon, a 28-pixel figure — in cobalt,
  steel, indigo and emerald. The panel keeps a border and no shadow, as
  design.md says.
  - **Checks:** `shell-ui.test.ts` passes, 12 tests, the new component test
    among them.

## 4. The browser suite

- [x] 4.1 The specs in `packages/server/e2e` that find a section by the `h2`
  it no longer has, or wait on the "OpenSpec UI" level-one heading, find the
  tab panel by its test id and wait on the application bar instead.
- [x] 4.2 `packages/server/e2e/frame-screenshots.spec.ts` opens the summary
  tab at 1280 pixels in light and in dark, asserts the `h1` names the tab,
  and writes `docs/images/standalone/frame-light.png` and `frame-dark.png`.

  Done on 2026-09-16. Eleven lookups in four specs moved: six sections found
  by an `h2` in `documentation-screenshots.spec.ts`, one each in
  `harness-screenshots.spec.ts` and `standalone.spec.ts`, and the three
  waits on the "OpenSpec UI" heading. The frame spec waits for the
  summary's last reading to return before it captures: its first run
  photographed the reading line and the held controls.
  - **Checks:** `frame-screenshots.spec.ts` passes alone; server typecheck
    passes.

## 5. Checks

- [x] 5.1 `openspec validate the-shell-wears-the-site-frame --strict` passes.
- [x] 5.2 `npm run verify` passes, run unpiped. Record each package's count.
- [x] 5.3 A changeset: `@openspec-ui/webui` minor, `openspec-ui-vscode` patch.
- [x] 5.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.
- [x] 5.5 The whole standalone browser suite passes, including the axe WCAG AA
  runs in both themes. Record the count.

  Done on 2026-09-16.

  - **5.1:** "Change 'the-shell-wears-the-site-frame' is valid".
  - **5.2:** run with its output redirected to a file. Typecheck and lint pass
    in every package. Tests: cli 161, core 1,487 (plus 4 in its scripts),
    extension 379, server 103, webui 543 of 544. The one webui failure is the
    known `build-metro-icons.test.mjs` comparison of an LF-stored module with
    its CRLF checkout on Windows; it passes on the Linux runner, and it makes
    verify exit 1 here.
  - **5.3:** `.changeset/the-shell-wears-the-site-frame.md`.
  - **5.4:** after staging every file by name.
  - **5.5:** 22 tests, 22 passed in 8.8 minutes, the WCAG 2.1 AA axe runs in
    both themes among them. The first whole run failed one:
    `standalone.spec.ts` looked for the owl in `.openspec-shell-headline`,
    which the application bar replaced; it now looks in the bar. Every
    standalone picture is taken again, since each carries the new palette.
- [x] 5.6 **Human-only.** Whether `frame-light.png` and `frame-dark.png`
  match the mockup's frame — the application bar, the page head, the tab row
  and the footer — in each theme.

  Record, 2026-09-16: the owner compared the running site with the mockup —
  the standalone server on port 4317, built from the Harness Settings branch,
  which carries this change and the ones beneath it — rather than the
  pictures, and found it good: "As far as I'm concerned, everything is fine."
