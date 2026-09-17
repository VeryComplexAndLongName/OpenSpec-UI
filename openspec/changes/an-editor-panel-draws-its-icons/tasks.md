The owner's report of 2026-09-17: no gear beside "Global harness settings"
in VS Code, while the site shows it.

## 1. The policy

- [x] 1.1 `packages/extension/src/webview/icon-font-source.ts` exports
  `ICON_FONT_SOURCE`, `font-src data:;`, with why.
- [x] 1.2 `harness-settings-panel.ts`, `pipeline-panel.ts`,
  `timeline-panel.ts` and `ai-panel.ts` add it to the policy of the page that
  runs their bundle. The AI panel's local-server page, an iframe with no
  bundle, is left as it is.

## 2. Tests

- [x] 2.1 `icon-font-source.test.ts` reads every panel source's bundle
  policy, requires the directive in each, and allows no other font source.
- [x] 2.2 `harness-settings-panel.test.ts` asserts the rendered page's
  policy carries `font-src data:;`.
- [x] 2.3 The mechanism is shown in Chromium: the icon font under the shipped
  policy fails with a CSP violation, and loads with the directive added.

  Record, 2026-09-17: shown in Chromium, which a webview is, with the
  generated icon stylesheet and the policy as a meta tag. Under the shipped
  policy (`default-src 'none'; script-src …; style-src … 'unsafe-inline';`)
  the `openspec-metro-icons` face ends with status `error`, the console
  logs a Content Security Policy violation for the `data:font/woff` source,
  and `document.fonts.check` is false for the cog glyph. With `font-src
  data:;` added the face is `loaded`, the check is true, and no violation is
  logged. `icon-font-source.test.ts` finds exactly the four panel sources
  that build a bundle page's policy.

## 3. Checks

- [x] 3.1 `openspec validate an-editor-panel-draws-its-icons --strict`
  passes.
- [x] 3.2 `npm run verify` passes, run unpiped. Record each package's count.
- [x] 3.3 A changeset: `openspec-ui-vscode` patch.
- [x] 3.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass.

  Record, 2026-09-17: `openspec validate --strict` valid. `npm run verify`,
  unpiped: typecheck and lint pass in every workspace; tests — cli 161, core
  1487 + 4, extension 381, server 103, webui 561 of 562. The one webui
  failure is `scripts/build-metro-icons.test.mjs`, the known Windows
  line-ending comparison of the generated icon module, which passes on Linux
  CI and is untouched here. `lint:english` (after `git add`),
  `lint:changesets`, `lint:test-budgets` and `lint:source-text` pass.

- [ ] 3.5 **Human-only.** With the release carrying this change installed,
  the gear beside "Global harness settings" is drawn in VS Code.
