## Why

Raised directly in a repository conversation on 2026-08-31: `openspec/
README.md`'s "Agentic Harness — how to work with it" section and the
standalone/extension screenshot galleries (`packages/server/README.md`,
`packages/extension/README.md`, per `openspec/changes/archive/2026-08-23-
document-product-screenshots/`) describe the Harness Settings UI and the
"Run with Agentic Harness" entry point in prose only — no reader has seen
either screen. This is a documentation-only change: no behavior changes.

## What Changes

- New `packages/server/scripts/capture-harness-screenshots.mts`: a
  Playwright-driven capture script (not a CI test — not wired into
  `playwright.config.ts`/`test:browser`) that starts a real
  `@openspec-ui/server` against a temporary fixture workspace (a change
  plus a populated `openspec/agent-harness.json`) and saves PNGs for the
  Harness Settings tab and the Change Editor tab's "Run with Agentic
  Harness" button/state.
- New `docs/images/standalone/harness-settings.png` and
  `docs/images/standalone/run-with-harness.png`.
- `packages/server/README.md`: new "Configure and run with Agentic
  Harness" gallery entry, same convention as the existing sections.
- No VS Code extension screenshots: Playwright drives a web page, not the
  native VS Code desktop UI — the existing extension screenshots in
  `docs/images/extension/` were captured manually, and the extension's own
  Harness Settings surface is a native VS Code text editor tab (the
  `openspec-ui.configureHarness` command opens the raw JSON file), not a
  custom-rendered view, so there is no comparable extension-side screen to
  automate here.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this is a documentation-only change)

## Impact

- `packages/server/scripts/capture-harness-screenshots.mts` (new)
- `docs/images/standalone/harness-settings.png` (new)
- `docs/images/standalone/run-with-harness.png` (new)
- `packages/server/README.md`
