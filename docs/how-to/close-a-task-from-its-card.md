# Close a task from its card

A change worked in the worktree made for it (`.worktrees/<repo>/<change>`,
on the branch named after the change) is worked from its Pipeline card. You
do not need to find its `tasks.md` under `.worktrees`, edit it, commit it and
push it by hand.

Nothing below is offered for a change read from this checkout or from
another change's worktree: those cards stay read-only (ADR 0026, amended
2026-10-05).

## Read a task whole

Hover a task on an open card to see all of it, with what is written under
it. Select the task to open it whole beside the board.

## Close or reopen it

**1.** Select the task on its card.

**2.** Write what was checked, and press **Close the task**. A note is
required for a **Human-only** or **Delegated** task, because the merge gate
refuses one closed with nothing written under it. It is optional otherwise.

The checkbox is ticked and nothing else on its line changes. The note goes
under the task as `Closed by <your git identity> on <date>: <note>`.
**Reopen the task** works the same way, and its note is optional.

The card refuses while a run is working in that worktree, and names the
run: the run may be editing the same file. It also refuses when the line
changed since the card was read. Read it again and try once more.

## Send it

Press **…** on the card, or open any of its tasks, and press **Commit and
push tasks.md**. The commit holds that file alone, whatever else is
changed or staged in the worktree, and the worktree's branch is pushed. It
is never made on the default branch. A refused push keeps the commit and
says what git said.

## Open the change where it is worked

Select the change's name on its card:
- **In the editor**, the worktree's `tasks.md` opens in a tab of its own.
  The card's panel also opens the proposal and the design, shows the specs
  folder, opens the worktree in a new window, and copies its path.
  **Go to line** opens `tasks.md` at the task.
- **In a browser**, a new tab shows the change's tasks, each whole, with the
  same controls. **Go to line** scrolls there.

A change with no worktree of its own opens this checkout's copy, read-only.

## Run a delegated task

A task marked **Delegated to `<agent>`** offers **Run on `<agent>`**. The
agent runs in the change's worktree, as `openspec-ui-cli run --cwd` would
run it there.

## Hide what is done

**Hide done** on an open card lists only its open tasks. The choice is kept
like the open cards.

## From a terminal

```bash
openspec-ui-cli task done the-change 6.4 --note "seen in the Pipeline"
```

```bash
openspec-ui-cli task commit the-change
```

`task reopen` unticks. Each exits `1` with the reason when refused.

Every command and its exit codes: [README](../../README.md#ci-cli-merge-gate).
