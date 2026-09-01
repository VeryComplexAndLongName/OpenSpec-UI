## 1. Shared helpers

- [x] 1.1 `packages/extension/src/commands.ts`, next to the existing
  `showCommandError` (line 74): add `function warnNoWorkspace(): void`
  (`showErrorMessage("OpenSpec UI: open a folder or workspace first.")`)
  and `function warnNoTreeSelection(kind: "change" | "template" |
  "task"): void` (`showWarningMessage(\`OpenSpec UI: select a ${kind} in
  the tree first.\`)`).
- [x] 1.2 Update the three pre-existing ad hoc
  `showErrorMessage("OpenSpec UI: open a folder or workspace first.")`
  call sites (`createChange` ×2 around line 580/608, `openAiPanel` around
  line 1173) to call `warnNoWorkspace()` instead — same message, single
  source now.

## 2. Split guards in the 15 affected commands

For each command below, split its existing combined `if (!workspaceRoot
|| !item || <state check>) return;` into: `if (!workspaceRoot) {
warnNoWorkspace(); return; }`, then `if (!item) { warnNoTreeSelection(
"<kind>"); return; }`, then the existing state check unchanged (stays a
silent `return` — see design.md, "'Wrong state' ... stays silent").
`kind` per command: `"change"` for every `ChangeTreeItem`-typed one,
`"template"` for `TemplateTreeItem`-typed ones, `"task"` for
`TaskTreeItem`-typed ones.

- [x] 2.1 `configureHarnessForChange` (line ~487) — "change"
- [x] 2.2 `runWithHarness` (line ~507) — "change"
- [x] 2.3 `validateSelectedChange` (line ~663) — "change"
- [x] 2.4 `showChangeTimeline` (line ~683) — "change"
- [x] 2.5 `archiveChange` (line ~696) — "change" (the change that
  surfaced this bug — verify manually in a real Extension Development
  Host that "OpenSpec UI: Archive Change" from the Command Palette now
  shows the warning instead of doing nothing)
- [x] 2.6 `unarchiveChange` (line ~719) — "change"
- [x] 2.7 `copyTasksAsTemplate` (line ~741) — "change"
- [x] 2.8 `customizeTemplate` (line ~765) — "template"
- [x] 2.9 `insertTemplateIntoChange` (line ~791) — "template"
- [x] 2.10 `deleteProjectTemplate` (line ~841) — "template"
- [x] 2.11 `deleteChange` (line ~862) — "change"
- [x] 2.12 `revealTask` (line ~884) — "task" (currently has no
  `workspaceRoot` check at all — only add the "no item" branch, do not
  invent a workspace-root requirement that was never there)
- [x] 2.13 `deleteTask` (line ~897) — "task"
- [x] 2.14 `startImplementation` (line ~921) — "change"
- [x] 2.15 `rollbackChange` (line ~983) — "change" (same note as
  `revealTask`: no pre-existing `workspaceRoot` check, don't add one)

## 3. Tests

- [x] 3.1 `commands.test.ts`: for each of the 15 commands, one new test
  invoking it with `item` omitted (`vscodeMock._registeredCommands.get(
  "openspec-ui.<command>")?.()`), asserting `showWarningMessage` was
  called with the exact "select a ... in the tree first" text for that
  command's `kind`, and that no mutating call (`archiveChangeMock`,
  `unarchiveChangeMock`, etc.) happened.
- [x] 3.2 `commands.test.ts`: one test confirming `warnNoWorkspace()`'s
  message text is byte-identical to what `createChange`/`openAiPanel`
  already asserted before this change (regression guard for the
  literal-to-helper consolidation in task 1.2).
- [x] 3.3 Existing happy-path tests for all 15 commands still pass
  unmodified (confirms the state-check branches were preserved exactly).

## 4. Verification

- [x] 4.1 `openspec change validate --strict
  tree-command-selection-feedback`.
- [x] 4.2 typecheck/lint/test for `extension`.
- [ ] 4.3 Live manual smoke test in a real Extension Development Host
  (not just unit tests, per this repository's own apply guidance for
  `server`/`extension` changes): invoke "OpenSpec UI: Archive Change" via
  the Command Palette with no change selected in the tree, confirm the
  warning message appears; then right-click a real change in the tree and
  confirm "Archive Change" still works exactly as before.
- [x] 4.4 `openspec/specs/vscode-extension/spec.md` delta — new
  requirement, scenarios matching tasks 3.1.
- [x] 4.5 Version bump via `npx changeset` (`openspec-ui-vscode`, patch —
  a genuine user-visible bug fix, unlike this session's earlier
  tooling-only changes).
