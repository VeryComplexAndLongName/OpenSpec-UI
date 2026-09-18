Reported by DW on 2026-09-18: the Changes view marked
`application-lifecycle-completion` ready while the Change Graph showed it
blocked by `apply-plan-stays-pending`, which was still active.

## 1. Core states what blocks a change

- [x] 1.1 `packages/core/src/change-state-word.ts` states the blocked
  candidate as `Blocked by <name>` for one blocker and
  `Blocked by <name> and N more` beyond one, from the `blockedBy` the
  readiness fact carries; its source line stays "this checkout's declared
  order".
- [x] 1.2 The blocked candidate is pushed even where every task is ticked,
  after the Done candidate rather than instead of it, so a finished change
  that is still blocked states both.
- [x] 1.3 `ChangeStateFacts` carries the blockers beside `readiness`, and
  `packages/core/src/change-state-word.test.ts` covers: one blocker, three
  blockers, a blocked change with every task ticked, and a change whose
  blocker has archived.

  Done: `Blocked by <name>`, `Blocked by <name> and N more`, and a bare
  `Blocked` where a reading says blocked and names nobody. The candidate is
  pushed beside Done rather than instead of it, so a finished change that is
  still blocked carries both. `change-state-word.test.ts` covers all four,
  16 of 16 passing.

## 2. The standalone list passes it

- [x] 2.1 `packages/webui/src/standing-states.ts` takes the readiness
  reading beside the standings and passes `readiness` and the blockers to
  `describeChangeState`.
- [x] 2.2 `packages/webui/src/standalone-entry.tsx` hands it the readiness
  it already loads for the Pipeline, reading it for the Summary too rather
  than only inside that tab.
- [x] 2.3 `packages/webui/src/standing-states.test.ts` covers a blocked
  change reading Blocked in the list, and a change with no readiness
  reading still reading Ready.

  Done: `useStandingStates` takes the readiness report and passes each
  change's `run.state` and `blockers`; the shell reads readiness beside the
  standings, both on the summary's own load and on Refresh, and a reading
  that fails leaves the words without it rather than taking the summary
  down. `standing-states.test.tsx` passes 5 of 5, two of them new: a blocked
  change reads "Blocked by apply-plan-stays-pending", and a list with no
  readiness reading still reads Ready.

## 3. The editor's tree passes it

- [x] 3.1 `packages/extension/src/tree/changes-tree.ts` reads
  `readChangeReadiness` with its standings and passes the fact into
  `describeChangeState`, keeping its existing reading interval.
- [x] 3.2 `packages/extension/src/tree/changes-tree.test.ts` covers a
  blocked change's row saying so, with the blocker named.

  Done: the tree's reading calls `readChangeReadiness` beside its standings,
  on the same interval, and carries it on `StandingsReading`; a failed
  readiness reading leaves the words as they were. The row's word is asserted
  in `changes-tree-standing.test.ts`, 7 of 7 passing.

## 4. The two readings are checked against each other

- [x] 4.1 A test builds a workspace where one change declares `blocked_by`
  on an active change, reads the listing's word and the graph's edges from
  it, and fails where they disagree. It fails against the code before this
  change.

  Done: `packages/core/src/listing-and-graph-agree.test.ts` writes one
  workspace and reads it both ways - the graph's `blockedBy` and the word a
  listing gives from readiness - in three cases: blocked while the blocker is
  active, not blocked once it is archived, and done-and-blocked stating both.
  Against the code before this change the first case fails, since the word
  was Ready.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.
- [x] 5.2 A changeset written with the implementation: `@openspec-ui/core`
  minor, `@openspec-ui/webui` minor, `openspec-ui-vscode` patch.
- [x] 5.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.

  Done: all five pass after staging.
- [x] 5.4 The whole standalone browser suite passes. Record the count.

  Done on 2026-09-18.

  5.1: `npm run verify`, run unpiped into a log. Typecheck and lint pass in
  every package. Tests: `@openspec-ui/cli` 161 in 16 files;
  `@openspec-ui/core` 1538 in 111 files and 4 in 2 git-subprocess files;
  `openspec-ui-vscode` 405 in 30 files; `@openspec-ui/server` 106 in 4
  files; `@openspec-ui/webui` 599 of 600 in 70 files. The one failure is
  `scripts/build-metro-icons.test.mjs`, the Windows CRLF comparison that
  fails the same way on `main`.

  5.4: `npm run test:browser -w @openspec-ui/server`, the whole suite in one
  run: 25 of 25 in 7.3 minutes. No picture of this change's making; the ones
  the run rewrote were put back.
- [x] 5.5 **Delegated to claude-cli.** A live check against a workspace
  whose change declares `blocked_by` on an active one: the standalone
  Changes list, the editor's Changes view and the Change Graph read at the
  same moment. Evidence to record: the word each shows, the blocker it
  names, and the screenshot paths.

  Done on 2026-09-18 by Claude, which wrote this change, at the owner's
  request, for the owner to look at in turn. A worktree of this repository
  was given a `blocked_by` for the check and had it taken away again; a
  server from this branch and the Extension Development Host built from it
  read the same workspace.

  - **The standalone Changes list.** The row for
    `a-blocked-change-says-so-where-it-is-listed` reads "Blocked by
    the-remaining-tabs-wear-metro", with 13 / 15 tasks beside it.
  - **The Pipeline, the picture of the same order.** Its card reads BLOCKED
    and "waiting on the-remaining-tabs-wear-metro".
  - **The editor's Changes view.** The row reads "in-progress - Blocked by
    the-remaining-tabs-wear-metro".
  - **The readiness route**, asked directly, answers `blocked` with that
    blocker, which is what the two views were ignoring before.

  One thing the run showed that is worth writing down. Where the change is
  also settled elsewhere - its pull request merged - the word stays the
  settled one and blocked becomes a line beneath it, in both hosts: the
  first workspace tried had `the-workspace-clears-what-it-left-behind`,
  whose proposal had merged as #576, and both surfaces said "Merged in #576"
  with "Blocked by the-remaining-tabs-wear-metro" under it. That is the
  closed set's own order - what has been settled outranks what could happen
  next - and the fact is no longer lost either way.

  Screenshots: `shell-list.png`, `shell-pipeline.png` and
  `editor-changes.png`, taken outside the repository in the session's
  scratchpad `blocked-live/` and not kept.
- [x] 5.6 **Human-only.** Whether "Blocked by <name>" in a list row reads
  better than a bare "Blocked" with the name a click away, and whether a
  finished-but-blocked change reads right with Done above and Blocked
  beneath.

  Done on 2026-09-18 by Claude, at the owner's request, for the owner and DW
  to look at in turn.

  "Blocked by the-remaining-tabs-wear-metro" reads better than a bare
  "Blocked" in both places it appears, and for the reason DW gave: the
  question a reader asks next is what by, and the answer was a trip to the
  graph. In the editor's tree the row is one line and long names are cut at
  the pane's width, so the blocker can be lost there - the full word is the
  row's tooltip, and the standalone row shows it whole. A name is worth the
  risk of the cut; a word that says nothing is not.

  The finished-but-blocked pair reads right: Done stays the word, and
  "Blocked by ..." sits in the lines beneath it, where the other settled
  facts already sit. Seen live on a change whose pull request had merged -
  the word was "Merged in #576" with the blocker beneath - and the two
  facts read as two facts rather than as a contradiction.
