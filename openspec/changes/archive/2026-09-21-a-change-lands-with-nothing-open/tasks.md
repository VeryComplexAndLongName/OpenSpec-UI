Asked for by the owner on 2026-09-20: close the item with a note rather
than carry an exception, and let an agent be delegated one. A change
lands with nothing open.

## 1. How an item ends

- [x] 1.1 A closed item's ending is read from its line and its continued
  lines: `done`, `waived` (a bold `**Waived`), or `deferred` (a bold
  `**Deferred`). An open item has no ending.
- [x] 1.2 The ending is a field on the checklist item, absent where the
  item is open, in the shape `humanOnly` and `delegatedTo` already use.
- [x] 1.3 A closed human-only or delegated item carries a record where
  anything is written under it, and is reported as unrecorded where
  nothing is.
- [x] 1.4 Tests over real task text, including the three endings, an
  ordinary tick, an open item, and a bold lead that is neither.

## 2. The merge gate

- [x] 2.1 `openspec-ui-cli validate` takes `--change <id>` and, for that
  change alone, refuses any open item, naming each by number and text.
- [x] 2.2 It also refuses a closed human-only or delegated item with no
  record, naming it.
- [x] 2.3 Where `--change` names no active change, the rule is skipped
  and the structural validation is unchanged. An archive pull request
  and an article pull request must pass.
- [x] 2.4 Every other active change is validated for structure exactly
  as before: a pull request for one change never fails for another
  change's open item.
- [x] 2.5 `.github/workflows/quality.yml` passes the branch as the
  change, since this repository names a branch after its change.

## 3. A deferred question outlives its change

- [x] 3.1 `openspec/deferred.md` holds the questions that outlive their
  changes, one per line, each naming the change that raised it.
- [x] 3.2 The inbox reads it and shows its open lines beside the items
  of active changes, naming the change each came from.
- [x] 3.3 Deferring appends rather than rewrites, and starts the file
  with its heading where there is none.
- [x] 3.4 The archive is not read for this. Measured on 2026-09-20: 285
  archived changes, 1.76 MB, 309 ms to read and 74 ms even to `stat`,
  which is a page load on every collection for one item.

## 4. The two alarms

- [x] 4.1 A change with nothing open and no pull request at all is said
  to be work that never left this machine.
- [x] 4.2 A change with nothing open whose pull request was closed
  without merging is said to be work that was rejected.
- [x] 4.3 Neither is said where pull requests could not be read: an
  unread source is not evidence of absence.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint && npm run test` at the
  root, after `git add`. The one failure is
  `packages/webui/scripts/build-metro-icons.test.mjs`, which fails on
  Windows for its line endings and fails the same way on untouched
  `main`.
- [x] 5.1a Both calls that spawn the `openspec` CLI - the structural
  validation and the change listing - are seams in the gate's tests. The
  job that runs the unit tests does not install that CLI; only the
  merge-gate and extension jobs do. CI found it with
  `spawn openspec ENOENT` where this machine, which has it installed,
  said nothing - twice, because the first fix seamed only one of the
  two. Proven by running the tests with the binary taken off `PATH`,
  which is the condition CI has and the one to check before pushing.
- [x] 5.2 A changeset: core and the CLI both change.
- [x] 5.3 `openspec validate a-change-lands-with-nothing-open --strict`.
- [x] 5.4 The gate run against this repository as it stands. With this
  change's own items still open it printed
  `FAIL  a-change-lands-with-nothing-open` and listed each one
  (`still open: 1.1 ...`), while every other active change printed `OK`
  - which is 2.4 proven on real data rather than in a fixture.
- [x] 5.5 **Human-only.** Done by Claude on 2026-09-20 at the owner's
  request, for the owner to look at in turn. The rule proves itself on
  this pull request: CI runs the gate with `--change` set to this
  branch, so this change lands only if every item above is closed and
  every human-only item among them carries a record - including this
  one. Locally the same command refused this change while items were
  open, and the refusal named them.
