# The web UI wears Metro

## Why

The owner moved the project site to Metro UI 5.1 and asked for the web UI to
use the same framework. Inside VS Code its colours must come from the editor's
theme, whatever theme that is, and nothing may be fetched from another origin.

ADR 0023 rejected Metro 5 for the standalone shell, on its tiles. On
2026-09-15 the owner chose Metro's components without tiles, and a dark theme
for the standalone shell that follows the system, with a toggle.
[ADR 0030](../../../docs/adr/0030-the-web-ui-uses-metro-components.md) records
that decision.

## What Changes

- **Metro UI 5.1.20 is vendored** as its published `metro.css` and MIT
  licence, pinned by version and checksum.
- **A build step derives the copy that ships:**
  - only the rules of the components the web UI uses;
  - every selector scoped under one root class;
  - no rule on a bare element.

  It is emitted as a TypeScript string, so the standalone shell and all four
  VS Code webviews carry it the way they carry `shellThemeCss` today.
- **The web UI's controls take Metro's classes.** Buttons, inputs, selects,
  textareas, checkboxes, tables, tabs, dialogs, progress and badges. Screen
  layouts, dense forms and the Pipeline picture keep their own structure.
- **Colours.**
  - **The standalone shell** uses Metro's light palette. It uses the dark
    palette when the system prefers dark, or when the header toggle says
    so; the toggle's choice is remembered.
  - **In VS Code**, a mapping layer sets every Metro variable the derived
    copy reads from `--vscode-*`. Dark and high contrast follow the class
    the editor puts on the page.
- **Tests keep ADR 0023's gates for the new variables.**
  - Every variable the derived copy reads is set by the VS Code layer.
  - No rule on a bare element survives the build.
  - Nothing references another origin.
- **Pictures.** Every picture under `docs/images/` is retaken, and axe's
  WCAG AA run covers both standalone themes.

## Capabilities

### Modified

- `shared-ui`: "Every colour the shell draws comes from a named token" and
  "The shell's own appearance stays out of a host editor" now cover Metro's
  variables.

### Added

- `shared-ui`: the standalone shell follows the system theme and remembers a
  choice. Metro ships as a scoped copy built from a pinned source.

## Impact

- `packages/webui`:
  - the vendored source, the build script and the generated module;
  - `shell-ui.ts`, the components' class names, and a theme toggle in the
    standalone entry.
- `packages/extension`: the VS Code mapping layer, carried by the four
  webview bundles.
- `packages/server`: the standalone shell's pictures and browser tests.
- `docs/adr/0030-the-web-ui-uses-metro-components.md` and its row in
  `docs/adr/README.md`.
- A direct development dependency for the CSS pass, where today it would
  only be transitive.
- A changeset: `@openspec-ui/webui` minor, `openspec-ui-vscode` minor,
  `@openspec-ui/server` patch.

## Out of scope

- **Tiles, Metro's app bar and side navigation.** Rejected by the owner and
  by ADR 0023.
- **`metro.js` and Metro's icon font.** The web UI renders no icon font, and
  React owns every behaviour.
- **The project site.** It already uses Metro.
