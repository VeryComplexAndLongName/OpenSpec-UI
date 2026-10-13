From a defect found on 2026-10-10: pull request #883 put
`cli-is-visible-on-the-homepage` back among the active changes after the
base archived it, and the merge gate passed it.

## 1. Core

- [x] 1.1 `packages/core/src/resurrected-changes.ts`: `readResurrectedChanges`
  returns each active change whose name the base has archived, with its
  archived folder; it exempts a change the base still has active, strips the
  date prefix, and throws where the base cannot be read. Exported from
  `packages/core/src/index.ts`.
- [x] 1.2 `packages/core/src/resurrected-changes.test.ts`: names a change put
  back, exempts the archive's own change, ignores a new change and a bare
  older archive, reads a name containing a date, and throws on an unreadable
  base. Verified to fail with the base-active exemption removed.

## 2. The merge gate

- [x] 2.1 `packages/cli/src/openspec-validate.ts`: `runValidateAll` reads
  `readResurrectedChanges` when a base is given, folds the findings into
  `resurrectedChanges` and into `ok`, and reuses `archiveCheckFailed` where
  the base cannot be read.
- [x] 2.2 `packages/cli/src/main.ts`: the text report prints one `FAIL` line
  per resurrected change, naming it and its archived folder.
- [x] 2.3 `packages/cli/src/openspec-validate.gate.test.ts`: the gate fails a
  change put back, passes the archive's own change, and says nothing without
  a base. Verified to fail when `ok` ignores the findings.

## 3. The existing duplicate

- [x] 3.1 `openspec/changes/cli-is-visible-on-the-homepage/` removed: the
  active copy with every task open, already archived as
  `2026-10-10-cli-is-visible-on-the-homepage`.

## 4. Documents

- [x] 4.1 `openspec/specs/ci-cli/spec.md` gains the requirement, carried by
  this change's delta.
- [x] 4.2 A changeset: core, cli - patch.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint`, and the affected core and CLI
  tests, with two workers.
- [x] 5.2 `openspec validate a-change-is-never-both-active-and-archived
  --strict`.
- [x] 5.3 On the real #883 head tree and its base listings: the check names
  `cli-is-visible-on-the-homepage`, archived as
  `2026-10-10-cli-is-visible-on-the-homepage`.
