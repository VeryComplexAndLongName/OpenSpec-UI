## 1. Core

- [x] 1.1 `packages/core/src/workbench.ts`: `DiscoverOpenSpecWorkspaceOptions`
  takes `changes: "active" | "archived" | "all"`, default `"all"`; the list
  not read is empty. `workbench.test.ts` asserts each choice on a workspace
  with one active and one archived change.
- [x] 1.2 `packages/core/src/task-checklist.ts`: `findTasksArtifactPath` reads
  only the list its `archived` argument names, and a new
  `readTaskChecklistOf(change)` returns a discovered change's items and the
  path they were read from, with no discovery of its own.
- [x] 1.3 `packages/core/src/worktree-survey.ts`: `surveyChanges` reads the
  directory's active changes once and each task list through
  `readTaskChecklistOf`. A failed reading marks the directory's changes
  unreadable with its reason.
- [x] 1.4 `packages/core/src/change-readiness.ts` reads the active changes
  once and takes each change's capabilities from that reading;
  `change-worktrees.ts`'s `listChangeWorktrees` reads the active changes
  only.
- [x] 1.5 A new `packages/core/src/pipeline-workspace-readings.test.ts`
  counts the readings through a mock of `./workbench.js`: a survey of two
  directories reads each once, for the active list; readiness reads the
  active list for itself and for the worktree listing; `readTaskChecklist`
  reads only the list it is asked for. Each also asserts the result it
  returns.
- [x] 1.6 A new `packages/core/src/bounded-map.ts` exports
  `mapBounded(items, limit, fn)`: results in the items' order, at most
  `limit` calls at once, the first failure rejecting and nothing started
  after it. `discoverChanges` reads `CHANGES_READ_AT_ONCE` (16) changes at a
  time. `bounded-map.test.ts` covers order, the ceiling, a failure, an
  empty list and a limit below one.
- [x] 1.7 `DiscoverOpenSpecWorkspaceOptions.names` reads only the change
  directories with those names, listed first, so a missing name costs
  nothing; `readChangesNamed(root, names)` returns them by name, the active
  change where both lists have one. `workbench.test.ts` covers both.
- [x] 1.8 `packages/core/src/change-graph.ts`: `readChangeGraph(root, {
  changes: "active" })` leaves the archived changes out, unread; the survey
  and readiness ask for it, since both keep only blockers that are active.
  `change-graph.test.ts` asserts the active graph keeps a relation naming
  an archived change and lists no archived node.
- [x] 1.9 `human-only-inbox.ts` and `delegated-items.ts` read the active
  changes once and each task list through `readTaskChecklistOf`.

## 2. The editor

- [x] 2.1 `packages/extension/src/webview/pipeline-panel.ts`: opening a
  change from a card looks among the active changes only.
- [x] 2.2 `packages/extension/src/tree/processes-tree.ts` reads the changes
  its processes name with one `readChangesNamed`, not a whole reading per
  name, active and then archived. `processes-tree.test.ts` asserts one
  reading, each name once, for five processes naming four changes.
- [x] 2.3 `packages/extension/src/tree/changes-tree.ts` lists the active
  changes from a reading of the active list only.
- [x] 2.4 `packages/extension/src/tree/archive-tree.ts` reads the archived
  list only, and exports `isUnderArchive(root, uri)`; `extension.ts`
  refreshes the Archive view on a file event only when the event is inside
  `openspec/changes/archive`. `archive-tree.test.ts` covers both.

## 3. Checks

- [x] 3.1 `openspec validate the-pipeline-reads-each-workspace-once --strict`
  passes.
- [x] 3.2 Each reading the editor's Pipeline asks for, timed against this
  repository with core from `main` and then from this branch, one after
  another in one process: readiness, survey, last runs, standings. Record
  the figures.

  Done on 2026-09-17, against `C:/Prog/OpenSpec-UI` with four working
  directories and 256 archived changes, one process for each version, the
  readings in order, as the editor's readers ask for them (standings with
  the fetch interval), before 1.6 to 1.9 and section 2:

  | Reading | `main` | this branch |
  | --- | --- | --- |
  | readiness | 1,280 ms | 376 ms |
  | survey | 34,407 ms | 773 ms |
  | last runs | 174 ms | 143 ms |
  | standings | 33,226 ms | 9,706 ms |

  Every reading returned the same number of bytes from both. An earlier run
  with three working directories gave `main` 4,485 ms, 39,053 ms, 226 ms and
  50,542 ms, and this branch 284 ms, 724 ms, 121 ms and 6,582 ms. What is
  left of a first standings reading is a network fetch (1.5 s alone), the
  pull request listing through `gh` (1.9 s alone) and one `git show` per
  change and branch; a second standings reading in the same process took
  1.1 to 1.7 s. The readiness report, which draws the cards, and the survey
  now return in under a second.
- [ ] 3.3 `npm run verify` passes, run unpiped. Record each package's count.
- [x] 3.4 A changeset, written with the implementation: `@openspec-ui/core`
  patch, `openspec-ui-vscode` patch.
- [ ] 3.5 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.
- [ ] 3.6 The whole standalone browser suite passes. Record the count.
- [x] 3.7 **Delegated to claude-cli.** Live: the Extension Development Host
  built from this branch, with this repository open and the OpenSpec view
  showing, opens the Pipeline command's panel and draws its cards with no
  reading timing out, in less than 10 seconds from the command. Record how
  long the first cards took and what the panel said, and the same for the
  released 0.60.1.

  Done on 2026-09-17 by Claude, which wrote this change, at the owner's
  request, for the owner to look at in turn. Playwright drove VS Code 1.137
  on `C:/Prog/OpenSpec-UI` (four working directories, 256 archived changes,
  49 changes in the process history), clicked the OpenSpec activity bar
  item, waited 3 s, ran "OpenSpec UI: Open Pipeline", and timed the first
  card from the command:

  - **The released 0.60.1**, from its installed folder: no card; after
    16.0 s the panel said "the host did not reply within 10 seconds to
    pipeline/readiness" and "The other working directories could not be
    read: the host did not reply within 10 seconds to pipeline/survey". An
    earlier run said the same after 13.7 s.
  - **This branch, before 1.6 to 1.9 and section 2**: the same timeout with
    the view showing, and cards after 2.9 s with it closed. A built
    extension with every workspace reading logged found the Processes view's
    49 lookups (section 2's cause) and, once they were fixed, the Archive
    view's and the Processes view's archive readings, 1.9 s and 0.8 s.
  - **This branch as committed**, four runs in a row: cards after 2.4 s,
    1.6 s, 1.3 s and 1.4 s; 5 cards each; the panel's last line "Last read …;
    other working directories …", both readings answered, and no reading
    reported as unanswered.
