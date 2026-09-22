Reported on 2026-09-22 by a user of 0.70.0: no relation could be stated on
a change with only `.openspec.yaml`, and Remove Relation was offered where
there was nothing to remove.

## 1. A change not written yet

- [x] 1.1 `LeftoverTreeItem`: a leftover with no archived change of its
  name takes `openspec-ui.unwrittenChange` and a tooltip saying what it
  lacks; an archived one keeps `openspec-ui.leftover`.
- [x] 1.2 `relationSubject` accepts that row; the menus offer Add Relation
  and Remove Relation on it, and Remove on both leftover kinds, inline and
  on right-click.

## 2. Remove Relation only where a relation is stated

- [x] 2.1 `relations-context.ts`: the `.related` mark, and the ids of the
  active changes stating a relation, read from `readChangeGraph`. The
  extension hands them to the Changes view on activation and when the
  graph's files change; a Change Graph row reads its own node.
- [x] 2.2 Remove Relation names only the marked rows; every clause naming
  a plain value names its marked one too; `contextValueOf` and
  follow-selection read a row without the mark.

## 3. Texts

- [x] 3.1 HARNESS.md's settings table lists `.model` with the fields the
  harness views edit.
- [x] 3.2 The review gate quick pick describes `agent-sufficient` as the
  `git` stage now behaves.

## 4. Checks

- [x] 4.1 Tests: the leftover's context value and tooltip by kind, and its
  mark; a graph row's mark; a relation command on an unwritten row; the
  ids read from a graph; the menu clauses, including that no plain row
  loses an entry by being marked.
- [x] 4.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped. typecheck and lint pass; lint's one
  warning, an unused `RunLogLine` in `packages/core/src/run-log.ts`, is
  on untouched `main` too. Tests: cli 18 files, core 123 and 6, extension
  36 (492 tests), server 4, webui 74 of 75. The one failure is
  `packages/webui/scripts/build-metro-icons.test.mjs`, which fails on
  Windows for its line endings and fails the same way on untouched `main`.
- [x] 4.3 The extension's integration suite passes: 18 passing.
- [x] 4.4 A changeset: the extension, patch.
- [x] 4.5 `openspec validate relations-and-leftovers-explain-themselves --strict`.
- [x] 4.6 Live, in VS Code 1.137 driven by Playwright with this build: a
  directory holding only `.openspec.yaml` offered Remove This Leftover
  Directory and Add Relation on right-click, and no Remove Relation. Add
  Relation -> Blocked by -> first wrote `blocked_by: first` into its
  `.openspec.yaml`, the Change Graph drew it waiting on first, and its
  menu then offered Remove Relation. A change stating no relation offered
  none; one stating `blocked_by` did. The first build of this change,
  which matched `resourceFilename` against a context key, failed this
  check while every unit test passed.
