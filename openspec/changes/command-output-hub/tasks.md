## 1. shared-ui: Structured command output

- [x] 1.1 Extend AI panel command picker to include `status`.
- [x] 1.2 Implement structured event rendering for stdout/stderr/completed
      payloads (JSON, checklist, key-value, bullets, fallback text).
- [x] 1.3 Add/adjust AI panel tests to verify parsing and rendering behavior.
- [x] 1.4 Persist shell inputs (`Workspace root (cwd)` and `Change directory`)
      across page reloads in standalone and extension webview entries.
- [x] 1.5 Coalesce fragmented stdout/stderr chunks into readable blocks before
      rendering to avoid word-splitting noise from streamed transport events.
- [x] 1.6 Add run-level analysis summary (steps, warnings, terminal result) for
      clearer interpretation beyond raw event chronology.
- [x] 1.7 Render OpenSpec `status --json` payloads as dedicated UI cards
      (progress bar, artifact states, instruction text) instead of plain text.

## 2. vscode-extension: Utility command menu

- [x] 2.1 Add command palette action to launch `openspec view` in an integrated
      terminal rooted at the active workspace.
- [x] 2.2 Add parsed UI action for selected change details (from
      `showChange(...)`) rendered as Markdown document.
- [x] 2.3 Add parsed UI action for selected change strict validation
      (from `validateChange(...)`) rendered as Markdown document.
- [x] 2.4 Update command registration tests for new command IDs and
      representative behavior.
- [x] 2.5 Extend `openspec-ui.openspecView` to also open a parsed markdown
      overview so users get a visual summary in addition to terminal output.
- [x] 2.6 Route extension-host status execution through JSON-native
      `openspec status --json` wrapper and emit structured events.

## 3. standalone-app: Parsed OpenSpec overview

- [x] 3.1 Add REST endpoint for OpenSpec overview (`list` + `list --specs`) to
      support visual summaries in standalone UI.
- [x] 3.2 Add standalone "OpenSpec view summary" panel with tabular, readable
      rendering of changes/specs and clear error reporting.
- [x] 3.3 Add standalone status-json endpoint and route status command through
      JSON-native status data instead of agent text output.

## 4. Verification

- [x] 4.1 `npm run test --workspace @openspec-ui/webui`
- [x] 4.2 `npm run test --workspace @openspec-ui/server`
- [x] 4.3 `npm run test --workspace openspec-ui-vscode`
- [x] 4.4 `npm run test --workspace @openspec-ui/core`
