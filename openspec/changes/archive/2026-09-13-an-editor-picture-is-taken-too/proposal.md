# An editor picture is taken too

## Why

Twenty-two pictures document this product. Thirteen are taken by a
Playwright spec against the standalone shell and regenerate whenever the
screen changes. Nine are not: they show the editor's own tree views,
menus and panels, and they are listed in `scripts/screenshot-baseline.json`
as hand-taken, with a `reason` of `editor-native`.

The reason recorded for them is that no agent can drive the editor's own
views or capture its window. **That is not true, and it was never
checked.** Playwright drives Electron, VS Code is Electron, and both
Playwright and a downloaded VS Code binary already sit in this
repository.

Measured on 2026-09-12: `_electron.launch()` against
`.vscode-test/vscode-win32-x64-archive-1.136.1/Code.exe` opened the
workbench, `window.screenshot()` captured it, and a second capture with
`mask`/`maskColor` masked a region — the same mechanism that satisfies
`every-screenshot-is-taken-by-a-spec`'s own rule that a capture must not
publish the machine it was taken on, and precisely the thing a screen
grab was said to lack.

The cost of leaving them hand-taken is already being paid. **102
commits** have touched the extension's tree views or its contributed
menus since the oldest of these was captured on 2026-08-22.
`repository-setup.png` is certainly wrong — `setup-offers-only-what-applies`
changed exactly what it shows — and no picture shows the Human-Only
Inbox view, which did not exist when these were taken. They are the
VS Code Marketplace listing, so what a prospective user sees is the
product of six weeks ago.

Deleting them was considered and rejected: it would close the gap by
emptying the extension's storefront of every screenshot.

## What Changes

- A Playwright spec launches the downloaded VS Code with the extension
  installed, against a **fixture workspace** rather than this
  repository, and captures the nine views.
- Regions that carry the machine they were taken on are masked, the way
  the standalone captures already mask the two path fields and the
  summary's meta line.
- The nine leave `scripts/screenshot-baseline.json`. Afterwards the
  baseline holds nothing, and `every-screenshot-is-taken-by-a-spec`'s
  rule is true without an exception rather than with nine.
- The spec is **not** part of the ordinary suite. It downloads and
  launches an editor; it runs where the standalone browser suite runs,
  on its own command.

## Impact

- `packages/extension` — a capture spec and its fixture workspace.
- `scripts/screenshot-baseline.json` — emptied.
- `scripts/check-screenshots.mjs` — a baseline that may now be empty,
  and the `editor-native` reason retired.
- No change to the pictures' paths, so `README.md` and the extension's
  README keep working.

This change exists because a claim in a task was believed rather than
checked — including by the agent reviewing it, who repeated it before
testing it.
