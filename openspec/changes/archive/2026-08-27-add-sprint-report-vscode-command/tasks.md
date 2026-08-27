## 1. Extension: command

- [x] 1.1 Add `promptSprintRange()` in `commands.ts`: two validated
  `showInputBox` prompts (`YYYY-MM-DD`), returning full-day ISO
  `rangeStart`/`rangeEnd` bounds.
- [x] 1.2 Register `openspec-ui.generateSprintReport`: reuses
  `pickChangesForTimeline`, then `promptSprintRange`, then calls
  `buildSprintReport`/`renderSprintReportPdf` from `@openspec-ui/core`
  directly, then `showSaveDialog` → `workspace.fs.writeFile` → a
  confirmation message with an "Open" action
  (`vscode.env.openExternal`). Errors reported via the existing
  `showCommandError` helper.
- [x] 1.3 Add the `contributes.commands` entry in
  `packages/extension/package.json` (Command Palette only, no tree
  item, matching `showAllChangesTimeline`).

## 2. Tests

- [x] 2.1 Add `showSaveDialog`, `workspace.fs.writeFile`, and
  `env.openExternal` stubs to `test-utils/vscode-mock.ts`.
- [x] 2.2 Add tests in `commands.test.ts` mirroring
  `showAllChangesTimeline`'s shape: builds the report for the picked
  range/changes and saves+offers to open the PDF; does nothing when no
  changes are picked; does nothing when either date prompt is
  dismissed; the date validator rejects a malformed date; does not
  write a file when the save dialog is dismissed; does not open the
  PDF when the confirmation message is dismissed; reports an error and
  writes no file when building the report fails.
- [x] 2.3 Add `openspec-ui.generateSprintReport` to the "registers all
  expected command ids" test.

## 3. Verification

- [x] 3.1 `npm run typecheck` and `npm run lint` (including
  `lint:english`) pass workspace-wide.
- [x] 3.2 `npm run test` passes workspace-wide, including all new
  test cases.
- [x] 3.3 Rebuild `packages/extension/dist/extension.js`
  (`npm run build --workspace openspec-ui-vscode`) and load it in
  plain Node with a stubbed `vscode` module: activation succeeds, and
  the bundle contains `pdfkit`'s real CommonJS build inline (not a
  runtime `require("pdfkit")`) — the same verification used to catch
  and confirm the fix for PR #96's bundling crash, now re-run with
  this command actually reachable.
- [x] 3.4 Propose a changeset (`npx changeset`) for
  `openspec-ui-vscode` (minor: new command, no breaking change)
  instead of hand-editing `version`/`CHANGELOG.md`; apply it via
  `npx changeset version`.
- [x] 3.5 Run `openspec change validate --strict
  add-sprint-report-vscode-command`.
