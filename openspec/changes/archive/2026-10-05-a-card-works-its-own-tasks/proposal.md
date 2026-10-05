## Why

The owner, 2026-10-05: the Pipeline's cards are hardly interactive. Each
change is worked in its own worktree under `.worktrees`, and finding its
`tasks.md` there by hand takes a while. On a card:

- a task's hint shows the first line only, so it is unclear which task it
  is;
- nothing ticks or unticks a task, so closing a **Human-only** item means
  finding and editing the file, then committing and pushing it by hand;
- the change's name opens nothing in the editor. The extension looks the
  change up in this checkout, where a change worked in its own worktree
  usually is not, and gives up.

ADR 0026 withheld every action from a directory other than this one,
including the change's own worktree. Its amendment of 2026-10-05 allows a
card to act on its change's own worktree, and only there.

## What Changes

- **A task is shown whole.** Each task row carries its whole text and what
  is written under it, and its line in `tasks.md`. Hovering shows all of it;
  selecting the row opens it in place, keyboard included.
- **A task is ticked or unticked from its card**, in the change's own
  worktree only. A note is written under the task, with who and when; for a
  **Human-only** or **Delegated** task the note is required, as the merge
  gate requires a record under one. Refused while a run works in that
  worktree, and when the line has changed since it was read.
- **"Commit and push tasks.md"** on the card commits that file alone in the
  change's own worktree and pushes its branch.
- **A delegated task can be started on its agent** from its row, in the
  change's own worktree.
- **The change's name opens its task list**:
  - in VS Code, `tasks.md` from the change's own worktree (or this
    checkout's copy where there is none) in a new tab, and a menu beside it
    for the proposal, the design, the specs folder, the worktree in a new
    window, and copying its path;
  - in the standalone app, a new browser tab showing the change's tasks,
    whole, with the same controls.
- "Go to line" on a row opens `tasks.md` at that task (VS Code) or scrolls
  the tasks tab to it.
- An open card can hide its done tasks, and scrolls to the task in hand.
- `openspec-ui-cli task done|reopen <change> <number> [--note]` and
  `openspec-ui-cli task commit <change>`, for a terminal and for agents.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui`: task rows shown whole; tick, untick, commit, run a delegated
  task and go to a line from a card; hide done tasks; the task in hand in
  view.
- `vscode-extension`: the change's name opens its task list from its own
  worktree; the card's menu.
- `standalone-app`: the change's name opens its tasks in a new browser
  tab; the routes the card's actions use.
- `ci-cli`: the `task` command.

## Impact

- `docs/adr/0026-...`: the amendment of 2026-10-05.
- `packages/core`: task rows gain their body and line; a module that finds
  a change's own worktree, ticks or unticks one task with a note, and
  commits and pushes that `tasks.md`.
- `packages/webui`: the card's task rows, controls and filter; a tasks tab
  for the standalone app.
- `packages/extension`: opening a change's files from its own worktree; the
  card's messages for tick, commit, run and go to line.
- `packages/server`: routes for the tasks tab and the card's actions.
- `packages/cli`: the `task` command.
- `HARNESS.md` or `README.md` where the Pipeline's card is described.
