From ADR 0044, step 2; the shape approved by the owner on 2026-10-09.

## 1. Extension

- [x] 1.1 `tree/workspace-tree.ts`: the Workspace view's rows - Open
  Pipeline, Open Dashboard, Workspace Harness, Agents, OpenSpec
  Configuration, Repository Setup, the declared checks. Tests.
  `workspace-tree.test.ts`, 8 tests (2026-10-09).
- [x] 1.2 `package.json`: the views in their new order, Processes and Change
  Graph folded; a change's menu is Show Actions... alone; the Inspect and
  Set Up submenus go; the checks leave the Changes title.
  `change-actions-parity.test.ts` and `relations-context.test.ts` follow
  (2026-10-09).
- [x] 1.3 `tree/changes-tree.ts`: the workspace rows leave; a change's row
  shows its card; a change worked only elsewhere has a row of its own.
  `changes-tree.test.ts`, `changes-tree-ownership.test.ts` (2026-10-09).
- [x] 1.4 `extension.ts`: the Workspace view registered, refreshed with the
  others and told the checks; Open Pipeline takes a change's name.
- [x] 1.5 `webview/pipeline-panel.ts`: `show(changeName)`, the ready
  handshake, and the embedded page's relay. Tests.
  `pipeline-panel.test.ts`, 4 new tests (2026-10-09).

## 2. Web UI

- [x] 2.1 `PipelineView`: `focus` - the card found once drawn, scrolled to,
  marked and focused. `show-card.ts` for the message both entries read.
  `PipelineView.focus.test.tsx`, 3 tests (2026-10-09).
- [x] 2.2 `pipeline-entry.tsx` says when it runs and shows the card asked
  for; `standalone-entry.tsx`, embedded, listens from the start.

## 3. Documents

- [x] 3.1 README and the extension's README: the Workspace view, Changes as
  a navigator, Show Actions...; the editor pictures' spec follows.
  All 17 editor pictures taken again on VS Code 1.137, last taken on
  2026-09-21; the archive menu's step named "Unarchive", gone since
  every-action-is-a-verb-and-a-noun, and now names Restore Change
  (2026-10-09).
- [x] 3.2 ADR 0044 amended with how step 2 was carried out.
- [x] 3.3 A changeset: extension and webui - minor.
  `.changeset/the-side-panel-is-the-workspace.md`.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint`; the extension's and the
  affected web UI tests, with two workers.
  2026-10-09: typecheck clean; lint 0 errors (4 warnings, none in files
  this change touched). The extension's 535 unit tests pass; the web UI's
  PipelineView 101 + 3, its waiting, card-style and vocabulary tests pass,
  with two workers.
- [x] 4.2 `openspec validate the-side-panel-is-the-workspace --strict`, and
  the merge gate with the worktree's absolute path as `--cwd`.
  2026-10-09: valid under `--strict`; the gate, run as `openspec-ui-cli
  validate changes`, named only 4.2 and 4.3 as open.
- [x] 4.3 **Human-only**: in VS Code, the side panel opens on Workspace;
  Agents lists the agents; choosing a change shows its card in the
  Pipeline; a change's menu is Show Actions...
  2026-10-10, the owner, on the extension 0.101.0 built from this branch:
  Agents, a change's card and its menu as described; the views took the
  manifest's order after View: Reset View Locations, since the editor keeps
  a layout it has shown ("All OK").
