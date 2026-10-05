## Context

See `proposal.md` and ADR 0026's amendment of 2026-10-05. What exists:

- `changeOfWorktree` (`change-worktrees.ts`) pairs a working directory with
  a change: not the main one, on a branch that is a valid change name. The
  survey sets `belongsTo` only where that change is also active in the main
  checkout, so a change that so far exists only in its own worktree (every
  change before its pull request merges) is drawn in that directory's own
  picture, as foreign, with no action.
- `parseChecklist` (`task-checklist.ts`) reads each item's line, its
  `lineNumber`, and `continued` (the wrapped rest of the sentence). The
  survey's `SurveyedTask` keeps the first line only, which is what the row's
  `title` shows.
- The extension's `openChange` looks the change up in the workspace root
  (`findActiveChange`) and opens `proposal.md` there. The standalone app's
  name button opens the Change Editor tab for the workspace root.
- `writeTaskCheckStates` writes a checkbox after re-verifying its line's
  text; `runDelegatedItem` runs a delegated item's agent on one line.
- The merge gate (`describeTaskDebts`) refuses a closed **Human-only** or
  **Delegated** item with nothing written under it.

## Goals / Non-Goals

**Goals:**

- A task is readable whole from its card.
- A person ticks, unticks, commits and pushes a task list from its card,
  in the change's own worktree, and the merge gate accepts what is written.
- The change's files open from its card wherever the change is worked.

**Non-Goals:**

- Any action in this checkout or in another change's worktree.
- Editing a task's text from the card. `tasks.md` stays the place for that.
- Committing anything but that change's `tasks.md`.
- Resolving a push that is rejected: it is reported, as `git` says it.

## Decisions

1. **"Own worktree" is resolved by the host from the change's name.**
   `resolveOwnWorktree({ git, repositoryRoot, changeName })` lists the
   worktrees and returns the one `changeOfWorktree` pairs with that name,
   where `openspec/changes/<name>/tasks.md` exists in it, or a refusal
   naming why ("no worktree of its own", "its worktree has no tasks.md").
   It does not require the change to be active in the main checkout. Every
   action takes the change's name and a line, never a path.
   - Rejected: trusting the path the card shows. A request is data from a
     page, and ADR 0026 names a change by the pair of directory and name.

2. **A task row carries its body and its line.** `SurveyedTask` gains
   `lineNumber` and `body`: the indented lines under the item up to the next
   item or heading, blank lines inside kept, dedented, line breaks kept,
   capped at 4 000 characters with the cap said. `text` stays the checkbox
   line. The row's `title` becomes the whole of it. Selecting the row opens
   it whole in a panel drawn over the board, as a run's logs are, rendered
   as Markdown by the renderer the Change Editor already uses.
   - Rejected: opening the row inside the card. A card's height is worked
     out in core from what it lists, and the cards of a column stack by
     those heights; a row grown in place would run into the card below.
     The panel also has room for the note a tick needs.

3. **A card for a change in its own worktree acts, wherever it is drawn.**
   A directory the survey pairs with a change by `changeOfWorktree` carries
   `ownChange` even where the change is not active in the main checkout; a
   card read from such a directory is the change's own, and gets the
   actions. A card read from this checkout or from any other directory
   gets none, and the name opens this checkout's copy read-only where there
   is one.

4. **Tick and untick: `setTaskDone`.**
   `setTaskDone({ repositoryRoot, changeName, lineNumber, expectedText,
   done, note?, by?, now })`:
   - finds the own worktree (decision 1);
   - refuses while a run works there: the worktree's lease is held and
     fresh, or a live status record names the change in that directory.
     The refusal names the run;
   - re-reads the line and refuses where its text is not `expectedText`;
   - refuses a tick of a **Human-only** or **Delegated** item without a
     note. A note is optional otherwise, and for an untick;
   - writes `[x]` or `[ ]` and nothing else on that line, then, where there
     is a note, one indented line directly under the item's existing body:
     `Closed by <by> on <YYYY-MM-DD>: <note>` or `Reopened by ...`. `<by>`
     is the worktree's configured git author, a claim, as everywhere here;
   - writes through a temporary file and a rename.

5. **Commit and push: `commitTaskList`.**
   `commitTaskList({ repositoryRoot, changeName })`, in the own worktree
   only:
   - stages that `tasks.md` alone (`git add -- <path>`), and says so where
     it has nothing to commit;
   - refuses on a detached head and on the repository's default branch;
   - commits with the message `tasks(<change>): ticked 6.4; reopened 2.1`,
     built from the staged diff's checkbox lines, with hooks as configured;
   - pushes the branch to its upstream, or to `origin` with `-u` where it
     has none. A rejected push is reported with git's words; the commit
     stays.
   Other modified files in the worktree are left as they are.

6. **Opening.**
   - VS Code: `openChangeTasks(changeName, line?)` opens `tasks.md` from the
     own worktree, or this checkout's copy, with `preview: false`, at the
     line where one is given. The card's menu adds proposal, design, the
     specs folder revealed in the Explorer, the worktree in a new window
     (`vscode.openFolder`, `forceNewWindow`), and copying its path.
   - Standalone: the name opens a new browser tab,
     `?view=tasks&change=<name>` with the session's token in the fragment.
     The page reads the change's rows through `POST /api/change-tasks`,
     shows every task whole, and offers the same controls through the same
     panel; "Go to line" scrolls to the row and marks it. Framed in the
     editor's Pipeline, the shell posts the request to the editor instead,
     as it already does for a change's name.

7. **A delegated task runs from its row.** The row of a **Delegated** item
   in an own worktree offers "Run on <agent>": `runOwnDelegatedItem` runs
   the inbox's `runDelegatedItem` with the own worktree as its workspace
   and runners the host builds for that root (`runnersFor`), as
   `openspec-ui-cli run --cwd` does there. The run passes that directory's
   allowlist, sandbox and audit, and its request and reply are recorded in
   that directory's log.

8. **Hide done, and the task in hand in view.** An open card offers "Hide
   done" (remembered per browser, like the open cards) and scrolls its list
   to the row marked in hand or probably next when it opens.

9. **Terminal.** `openspec-ui-cli task done <change> <number> [--note
   <text>]`, `task reopen <change> <number> [--note <text>]` and `task
   commit <change>` call the same core functions, resolving the number to
   its line in the own worktree. Exit 0 on success, 1 on a refusal with its
   reason, 2 where it could not be attempted.

## Risks / Trade-offs

- **A person can tick an agent's task.** That is the point of a control;
  the note says who did it, and the verify stage still rechecks what it
  checks.
- **The push goes to the server.** It is one explicit control per push, it
  carries one file, and it never runs on the default branch.
- **The survey grows by the task bodies.** Bounded per task, and read from
  files the survey already reads.
- **A run can start between the check and the write.** The window is the
  write itself; the line check refuses a line that a run changed first.
