## Why

`a-change-lands-with-nothing-open` made the merge gate refuse a change
with anything open. On 2026-09-21 a change was archived with an item
open anyway - `git-says-a-working-directory-is-done`, item 5.6 - and the
gate said nothing.

That was by design, and the design was wrong about one case. The rule
applies to the change a branch names, and an archive pull request names
no active change, so the rule is skipped for it. Skipping it is right
for the changes an archive pull request does not touch; it is wrong for
the ones it archives.

A change can be archived two ways, and both need the rule:

- **through this product** - the Pipeline's "Archive them", the editor's
  archive command, a harness stage - which all call `archiveChange` in
  core;
- **through `openspec archive` directly**, which this product does not
  control and which is how 5.6 got through.

## What Changes

- **`archiveChange` refuses a change with anything open,** naming each
  item, and a human-only or delegated item closed with nothing written
  under it. The CLI is not called.
- **The merge gate checks what a pull request archives.** Given the base
  it is merging into, it finds every directory that appears under
  `openspec/changes/archive/` in this pull request and applies the same
  rule to each. That catches an archive however it was made.
- **The rule itself moves to core.** What an item still owes was
  written into the CLI's gate, which is a transport adapter; with a
  second reader it belongs where the business logic lives, and both read
  it from there.
- CI passes the base branch, and fetches it, since a shallow checkout
  has no base to compare with.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - archiving refuses what is not finished.
- `ci-cli` - the gate checks what a pull request archives.

## Impact

- `packages/core/src/task-checklist.ts` (what an item owes),
  `packages/core/src/openspec.ts` (`archiveChange`), a small reader of
  what a ref's archive holds; `packages/cli/src/openspec-validate.ts`
  and `main.ts`; `.github/workflows/quality.yml`.
- A changeset: core and the CLI both change.

## Explicitly out of scope

- **Changing `openspec archive` itself.** It is another project's tool;
  the gate is where this repository can hold the line on it.
- **Re-checking the archive's history.** Only what a pull request
  archives is checked. The 285 changes already archived are records of
  their time, and reading them was measured yesterday at 309 ms for no
  benefit.
