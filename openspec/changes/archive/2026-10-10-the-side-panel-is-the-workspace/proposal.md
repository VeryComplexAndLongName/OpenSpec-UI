## Why

ADR 0044 decided that a change is worked on its card, and that the side
panel becomes the Workspace, in two steps. The first,
a-change-is-acted-on-from-its-card, put every action on the card. This is
the second. Until now the Changes view was still a second place to act on
a change - a right-click menu of more than ten actions in three groups and
two submenus - and it also held rows that belong to no change: OpenSpec
Configuration, Repository Setup and Harness Settings. A change worked in
its own worktree, now the usual change (ADR 0043), had no row at all, only
a line counting such changes. The owner approved the shape on 2026-10-09.

## What Changes

- A **Workspace** view, first in the side panel: Open Pipeline, Open
  Dashboard, Workspace Harness, **Agents** (each agent found or not, its
  version, the stages the workspace harness gives it), OpenSpec
  Configuration, Repository Setup, and Run Typecheck / Run Tests / Run Lint
  where the workspace declares them.
- The views in a new order: Workspace, Human-Only Inbox, Changes, Specs,
  Archive, Templates, Processes and Change Graph, the last two folded at
  first.
- **Changes is a navigator.** Choosing a change shows its card in the
  Pipeline - scrolled to, marked for a moment, focused - and its files are
  beneath it. A change worked only in another working directory has a row
  of its own, which shows its card.
- **A change's menu is Show Actions... alone.** Run, Send Message, Stop,
  the Inspect and Set Up submenus, Archive, Rollback, Delete, and the
  inline Show Diff and Validate Change go; each is in Show Actions... and on
  the card.
- The Pipeline shows the card its host asks for, in the extension's own
  webview and in the standalone page it embeds.
- ADR 0044 amended with how step 2 was carried out.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vscode-extension`: the side panel is the Workspace; Repository Setup
  moves to it; a change's menu is Show Actions...
- `shared-ui`: the Pipeline shows a card its host asks for.

## Impact

- `packages/extension`: `tree/workspace-tree.ts` (new), `tree/changes-tree.ts`,
  `extension.ts`, `webview/pipeline-panel.ts`, `package.json` (views,
  menus, submenus), their tests and the editor pictures' spec.
- `packages/webui`: `PipelineView.tsx` (`focus`), `show-card.ts` (new),
  `pipeline-entry.tsx`, `standalone-entry.tsx`, `shell-ui.ts`.
- README and the extension's README. A changeset for the extension and the
  web UI.
