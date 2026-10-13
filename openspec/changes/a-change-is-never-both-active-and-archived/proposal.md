# Proposal

## Why

On 2026-10-10 `cli-is-visible-on-the-homepage` was archived: pull request
#881 renamed its folder into `openspec/changes/archive/2026-10-10-…`. Eight
minutes later pull request #883 ("add 2 more changes") added the same change
back among the active ones, every task open, and the merge gate passed it.
The Pipeline then drew a change as unfinished that had already shipped.

The merge gate already compares the people and the histories against the
base, and holds each archived change to the open-item rule; it had no rule
for the reverse — a change put back after its base archived it. A change
being both active and archived makes the board lie, and nothing mechanical
refused the one pull request that could do it.

## What Changes

- The merge gate, with `--base <ref>`, refuses every active change whose
  name the base has archived, naming the change and its archived folder.
- The rule does not fire for the change a pull request is archiving: the
  archive's own pull request holds the active copy in the commit before it
  moves it, and the base still has it active.
- The one existing duplicate, `cli-is-visible-on-the-homepage`, is removed:
  its archived copy is the source of truth.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ci-cli`: the merge gate refuses a change that is both active and
  archived.

## Impact

`packages/core` (`resurrected-changes.ts`), `packages/cli`
(`openspec-validate.ts`, `main.ts`), the merge-gate tests, and
`openspec/specs/ci-cli/spec.md`. No command or event of the protocol
changes; `--base` gains one more comparison in the report it already
prints. A patch for `@openspec-ui/core` and `@openspec-ui/cli`.
