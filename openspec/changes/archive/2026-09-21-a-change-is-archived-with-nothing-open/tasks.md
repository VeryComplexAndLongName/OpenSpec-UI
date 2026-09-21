Asked for by the owner on 2026-09-21, after a change was archived with an
item open and the gate said nothing.

## 1. What an item owes, in core

- [x] 1.1 `describeTaskDebts(items)` in `packages/core/src/task-checklist.ts`
  returns the open items and the unrecorded human-only or delegated
  items, each as its number and text.
- [x] 1.2 The gate reads it from core instead of its own copy.

## 2. The product refuses

- [x] 2.1 `archiveChange` reads the change's task list first and refuses
  where it owes anything, naming each item, without calling the CLI.
- [x] 2.2 A test archives a change with an open item and one with an
  unrecorded human-only item, and asserts the refusal and that nothing
  moved.

## 3. The gate checks what a pull request archives

- [x] 3.1 `validate` takes `--base <ref>` - the ref the pull request
  merges into, reusing the flag other commands already take - and applies the rule
  to every directory under `openspec/changes/archive/` that is present
  in the working tree and absent from that ref's.
- [x] 3.2 The comparison reads two tree listings and needs no history,
  so a shallow checkout with the base fetched at depth one is enough.
- [x] 3.3 A ref that cannot be read is said, and fails the gate rather
  than passing it: a check that could not run is not a check that
  passed.
- [x] 3.4 `quality.yml` fetches the base and passes it.
- [x] 3.5 Tests over a real temporary repository: an archive added with
  an item open fails, one added closed passes, and an archive already
  on the base is not read.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint && npm run test` at the
  root, after `git add`, with the tests that could reach the `openspec`
  CLI also run with it off `PATH`. The one failure is
  `packages/webui/scripts/build-metro-icons.test.mjs`, which fails on
  Windows for its line endings and fails the same way on untouched
  `main`.
- [x] 4.2 A changeset: core and the CLI both change.
- [x] 4.3 `openspec validate a-change-is-archived-with-nothing-open
  --strict`.
- [x] 4.4 The gate run against yesterday's archive pull request as it
  was before 5.6 was closed: it fails, naming 5.6. Replayed from commit
  `a5ea388f` against its base `99015a06`, it printed
  `FAIL  archived 2026-09-21-git-says-a-working-directory-is-done` and
  `still open: 5.6 **Human-only.** The six directories on this machine`
  - the exact item that went through on 2026-09-21.
