## Why

The owner reported on 2026-09-17 that in VS Code the "Global harness
settings" panel has no gear beside its title, while the standalone site
shows it.

The icons are the Metro subset, a font carried inside the stylesheet as a
`data:` URL, so that a host refusing other origins still draws them —
`shared-ui` requires exactly that ("A host that refuses another origin: its
icons still draw"). #537 put that stylesheet into every editor entry. But
every editor webview's Content Security Policy is `default-src 'none'` with
no `font-src`, and `default-src 'none'` refuses `data:` fonts as well. The
stylesheet arrives; the font does not; every icon in the Harness Settings,
Pipeline, Timeline and AI panels is an empty box.

Reproduced in Chromium, which is what a webview is: under the shipped
policy the font face ends in `error` with a CSP violation logged; with
`font-src data:;` added it is `loaded`.

## What Changes

- The four editor panels that run a bundle — Harness Settings, Pipeline,
  Timeline and the AI panel — allow `data:` fonts in their policy, and no
  other font source.
- One constant names that directive, and a test reads the panels' sources so
  a panel written without it fails.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vscode-extension`: an editor webview's policy lets the shell's icons draw.

## Impact

- `packages/extension/src/webview/`: `icon-font-source.ts` (new) and its
  test, `harness-settings-panel.ts`, `pipeline-panel.ts`, `timeline-panel.ts`,
  `ai-panel.ts`, `harness-settings-panel.test.ts`.
- A patch changeset for `openspec-ui-vscode`.
