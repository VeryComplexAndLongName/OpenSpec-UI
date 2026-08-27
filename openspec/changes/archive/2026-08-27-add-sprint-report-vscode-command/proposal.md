## Why

Second half of the sprint-report feature approved in the 2026-08-26/27
product-direction discussion; `add-sprint-report-pdf` (merged, PR #96)
shipped the standalone-only half. Per
[ADR-0001](../../../docs/adr/0001-shared-core-two-delivery-targets.md),
the extension's primary mode is direct import of `@openspec-ui/core`
in-process, not a REST round-trip through `packages/server` — this
command follows that decision exactly as `showChangeTimeline`/
`showAllChangesTimeline` already do, calling `buildSprintReport`/
`renderSprintReportPdf` directly rather than adding a local-HTTP-only
code path.

This change is also what first makes the extension actually *execute*
`renderSprintReportPdf` at runtime, not just export it: PR #96's own
CI run caught `pdfkit` breaking extension activation entirely once it
was reachable through `@openspec-ui/core`'s barrel (esbuild's CJS
bundle couldn't shim pdfkit's ESM build's `import.meta.url`, throwing
"Invalid URL" for every command, not just the sprint report one) — that
was fixed by aliasing `pdfkit` to its CommonJS build at bundle time
(`packages/extension/scripts/build-options.mjs`), but the fix was
never actually exercised by a real pdfkit call from within the bundled
extension until this change's own command runs it.

## What Changes

- Add `openspec-ui.generateSprintReport`, a Command Palette-only
  command (no tree-item entry, matching `showAllChangesTimeline`'s
  pattern) in `packages/extension/src/commands.ts`:
  1. Reuses `pickChangesForTimeline` unchanged (multi-select across
     active/archived changes).
  2. Two validated `showInputBox` prompts (`YYYY-MM-DD`) for the
     sprint's start/end date — VS Code has no native date picker, and
     unlike `computeDefaultRange` this command needs a real
     user-specified range, not one auto-derived from data.
  3. Calls `buildSprintReport` then `renderSprintReportPdf` from
     `@openspec-ui/core` directly (already imported host-side; no
     server/REST involved).
  4. `vscode.window.showSaveDialog` (PDF filter) →
     `vscode.workspace.fs.writeFile` → a confirmation message with an
     "Open" action (`vscode.env.openExternal`).
- Add `contributes.commands` entry in
  `packages/extension/package.json`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vscode-extension`: adds a Requirement for the sprint report
  Command Palette command.

## Impact

- `packages/extension/src/commands.ts`
- `packages/extension/src/commands.test.ts`
- `packages/extension/src/test-utils/vscode-mock.ts` (adds
  `showSaveDialog`, `workspace.fs.writeFile`, `env.openExternal`
  stubs — no prior command needed them)
- `packages/extension/package.json` (`contributes.commands`)
- `.changeset/*.md` (new changeset file)
