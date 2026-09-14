# The owl marks the app

## Why

Nothing in OpenSpec UI says whose tool it is.
- The standalone page has no icon, so its browser tab shows a blank page.
- Its headline is text only.
- In VS Code, the listing icon is a generic page with lines, and the
  Activity Bar shows a document outline. Neither tells the extension apart
  from any text tool.

The project now has a logo, an owl, and the owner asked for it on every
surface.

## What Changes

- **The standalone shell.**
  - The owl stands at the left of the headline, 40 CSS pixels square, with
    an 80-pixel image for high-density screens.
  - The page names the owl as its icon, so the browser tab shows it.
- **The extension.**
  - The listing icon (`media/icon.png`) is the owl in colour, 256 pixels.
  - The Activity Bar icon (`media/icon.svg`) is a monochrome owl drawn in
    `currentColor`. VS Code paints that icon in one theme colour, so a
    colour image would show as a solid disc.
  - The AI panel's headline shows the owl as the standalone shell does. Its
    colours stay as they are: the dark disc reads on light and dark themes.
- **The images travel inside what already ships.**
  - The headline logo is a data URI in the web UI bundle, and the favicon is
    a data URI in `index.html`.
  - So the server still serves only its fixed paths, and the AI panel's
    Content Security Policy gains only `img-src data:`.
- **A test that waited too little.** `delegated-item-run.test.ts` waited for
  a status record with `vi.waitFor`'s default of 1 second. Under a full
  suite's load, the record can come later. The wait is raised.

## Capabilities

### Added

- `standalone-app`: the standalone shell is marked by the owl.
- `vscode-extension`: the extension is marked by the owl.

## Impact

- `packages/webui`: `src/owl-logo.ts`, the headlines in
  `standalone-entry.tsx` and `extension-entry.tsx`, and the headline style in
  `shell-ui.ts`.
- `packages/server/public/index.html`.
- `packages/extension`: `media/icon.png`, `media/icon.svg`, and the AI panel's
  Content Security Policy in `src/webview/ai-panel.ts`.
- `packages/core/src/delegated-item-run.test.ts`.
- A changeset for `@openspec-ui/webui`, `@openspec-ui/server` and
  `openspec-ui-vscode`.

## Out of scope

- **Metro UI**, and taking the web UI's colours from the VS Code theme. That
  is a change of its own, with an ADR.
- **New documentation screenshots.** They come in the documentation change
  that follows this one.
- **Muting the logo in VS Code.** The owner chose to keep its colours.
