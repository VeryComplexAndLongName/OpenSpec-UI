Requested by the owner on 2026-10-05: a card opens its change's task
list, shows each task whole, and ticks, unticks, commits and pushes in
the change's own worktree, and only there.

## 1. The decision

- [x] 1.1 ADR 0026's amendment of 2026-10-05 written: a change's own
  worktree is worked from its card; the directory is resolved by the host;
  every other directory stays observed; nothing is written while a run
  works there. The owner set the rule ("only for your own worktree") and
  agreed the proposals on 2026-10-05.

## 2. Core

- [x] 2.1 `resolveOwnWorktree` (design.md decision 1), with its refusals.
  Test in `own-worktree-tasks.test.ts`: a worktree on the change's branch
  with a `tasks.md`; none; one on another branch; the main checkout on that
  branch; a worktree without `tasks.md`; a name that is not a change name.
  A directory git cannot list is no worktree, not an error.
- [x] 2.2 `SurveyedTask.lineNumber` and `body` (decision 2), from
  `parseChecklist`'s new `body`; the survey's `ownChange` marks a directory
  paired with a change by `changeOfWorktree` even where the change is not
  active in the main checkout (decision 3). Tests: `task-checklist.test.ts`
  (a wrapped task, a record after a blank line, a nested list, a heading
  ending the body, a tab indent, the cap) and `worktree-survey.test.ts`
  (the lines, a body, `ownChange` without `belongsTo`).
- [x] 2.3 `setTaskDone` (decision 4). Test in `own-worktree-tasks.test.ts`:
  tick and untick, the note line and where it goes (under the continued
  lines, so `describeTaskDebts` counts it recorded), the required note, a
  changed line refused, a held lease refused and named, a live record
  refused and named, nothing else on the line changed, CRLF kept.
  `readChangeTaskRows` and `runOwnDelegatedItem` beside it: rows whole from
  the own worktree or, read-only, this checkout; a delegated run refused
  before any runner is asked for. 14 passed.
- [x] 2.4 `commitTaskList` (decision 5), in
  `own-worktree-tasks.commit.test.ts`, added to the `core-git-subprocess`
  project: only `tasks.md` committed with another file staged and left
  staged, the message, nothing to commit, no worktree of its own, a branch
  without upstream pushed with `-u`, a refused push keeping its commit. 5
  passed.

## 3. Hosts

- [x] 3.1 `packages/server`: `POST /api/change-tasks`,
  `/api/change-tasks/set`, `/commit` and `/run` (`own-worktree-rest.ts`),
  each taking the change's name and resolving the worktree; `runnersFor`
  builds runners for the own worktree, in `cli.ts` and the extension's
  optional server. Test in `own-worktree-rest.test.ts`: the rows read, each
  action refused where there is no worktree of its own, bad bodies, a cwd
  outside. 4 passed.
- [x] 3.2 `packages/extension`: the name opens `tasks.md` from the own
  worktree or this checkout (decision 6), in a tab of its own, at a line
  where one is named; proposal, design, specs (revealed in the system's
  file manager, since a worktree is outside the window's folder), a new
  window and the path; requests `pipeline/task-set`, `task-commit`,
  `task-run`. Tests in `pipeline-panel.test.ts`. This is also why the name
  opened nothing before: the extension looked the change up in this
  checkout, where a change not yet merged is not.
- [x] 3.3 `packages/webui`: rows hold their whole text in the hint and open
  whole in `TaskPanel`, a panel over the board (design.md decision 2 says
  why not in place); the controls of decisions 4, 5 and 7 only on cards
  read from an own worktree; "Hide done" kept in the view's memory, with
  the card's height following; the task in hand scrolled into view; the
  standalone app's `?view=tasks&change=` page (`TasksPage`) opened in a new
  browser tab; `task-actions.ts` turning both hosts' answers into the
  panel's words. Tests: `PipelineView.test.tsx` (5 new), `TasksPage.test.tsx`
  (4), `task-actions.test.ts` (3).
- [x] 3.4 `packages/cli`: `task done|reopen|commit` (decision 9) in
  `task-command.ts`, with `--note`. Test in `task-command.test.ts`: a close
  with its note, a refusal exiting 1, a commit, the cases exiting 2, and
  the command line reaching it. 4 passed.

## 4. Documents

- [x] 4.1 `docs/how-to/close-a-task-from-its-card.md`; the Pipeline's line
  in `README.md`; a row in `HARNESS.md`'s "Find what you need"; the `task`
  command in the CLI's own usage text.
- [x] 4.2 A changeset: core, webui, server, cli, extension, minor.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint`, and every test project, after
  `git add`, exit code 0, each project run on its own where the root run
  would exceed a background limit. 2026-10-05: typecheck 0; lint 0 (three
  warnings, all in files this change does not touch). The seven script
  tests 0; `server` 5/122, `cli` 22/196, `webui` 78/699, `extension` 36/502;
  `core` 2027 tests, of which one timed out while another package's tests
  ran beside it (`successor-check`, which reads the repository's whole
  archive) and passes alone, 10/10; `core-git-subprocess` file by file, 8
  files, 67 tests.
- [x] 5.2 `openspec validate a-card-works-its-own-tasks --strict`, and the
  merge gate with the worktree's absolute path as `--cwd`. 2026-10-05:
  "Change 'a-card-works-its-own-tasks' is valid"; the gate owes only 5.4,
  the Human-only item.
- [x] 5.3 One live close end to end: a scratch repository with a change in
  its own worktree and a bare remote; `task done` with a note on a
  Human-only item, then `task commit`; record the line written, the commit
  and the pushed ref, and the gate counting the item recorded.
  Record, 2026-10-05, scratch change `close-a-task` in
  `wt/close-a-task` on its own branch, pushed, with an unrelated
  `notes.txt` left in the worktree:
  - `task done close-a-task 1.2` without a note: "1.2 is Human-only: say
    what was checked, so the note can be written under it.", exit 1,
    nothing written;
  - with `--note "seen in the Pipeline"`: `- [x] 1.2 **Human-only**: look
    at it in the Pipeline.` and under it `Closed by live@example.invalid
    on 2026-10-05: seen in the Pipeline`, exit 0;
  - `task commit close-a-task`: "Committed 3359286f (tasks(close-a-task):
    ticked 1.2) and pushed to origin/close-a-task.", exit 0. The server's
    `close-a-task` holds that commit, naming
    `openspec/changes/close-a-task/tasks.md` alone; `notes.txt` is still
    untracked in the worktree;
  - the merge gate on that worktree reports no `openItems` and no
    `unrecordedItems` for the change. Its one failed item is openspec's own
    structural validation of a scratch change with no spec delta.
- [x] 5.4 **Human-only**: in the Pipeline of either host, open a change
  worked in its own worktree from its name, read a task whole, close a task
  with a note, and commit and push from the card.
  Closed by the owner on 2026-10-05 in the Extension Development Host built
  from this branch: "Checked by human. Everything works as expected."
