## Why

A change's branch falls behind the default branch while its pull request
waits. Since `main-no-longer-requires-an-up-to-date-branch` that no
longer blocks a merge, and it left a gap written into the runbook on
purpose: two pull requests that are green apart can be broken together.
The remedy is to rebase the branch, push it, and let its checks run
again - which on 2026-09-20 an agent did by hand after every merge, five
times in an afternoon, with a person noticing each time that it was due.

The owner asked for it to be the product's job, for everybody who uses
the product, as a setting that is on unless it is turned off. ADR 0034
records the decision and the one rule it is an exception to.

## What Changes

- **A behind branch is rebased and pushed** by the same sweep that
  removes a working directory whose work has landed, when every rail
  ADR 0034 names holds: the branch is named after a change, it was
  pushed and is still on the server, its tree is clean, no run is
  recorded against it, it has nothing the server lacks, and it is
  behind.
- **`--force-with-lease`** against the upstream as it was read, so a push
  somebody else made in the meantime is never overwritten.
- **A conflict is never resolved.** The rebase is aborted, the branch is
  left as it was, and the sweep reports which files conflict.
- **One setting**, `branches.rebaseWhenBehind` in
  `openspec/agent-harness.json`, `true` by default, overridable per
  change.
- **Both hosts sweep.** The standalone server reported finished working
  directories and offered to remove them; since
  `git-says-a-working-directory-is-done` the editor removes them. The
  standalone now runs the same sweep as the editor - removal and
  rebase - from the same core function.
- `README.md`, `HARNESS.md` and `openspec/README.md` say what the product
  does with branches now, and `HARNESS.md` says it beside the rule it is
  an exception to.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - the rebase, its rails, and the setting.
- `vscode-extension` - the editor's sweep rebases too.
- `standalone-app` - the standalone runs the same sweep as the editor.

## Impact

- `packages/core/src/git.ts` (rebase, abort, conflicts, a leased push),
  `packages/core/src/branch-rebase.ts` (new),
  `packages/core/src/harness-config.ts` (the setting),
  the editor's sweep in `packages/extension/src/extension.ts`, the
  standalone's leftovers endpoint in `packages/server/src/rest.ts`.
- `docs/adr/0034-a-behind-branch-is-rebased-for-you.md`.
- A changeset: core, the extension and the server change.

## Explicitly out of scope

- **Resolving a conflict.** Named and left, always.
- **Rebasing a branch this product did not name.** Only a change's own
  branch, by ADR 0022's pairing.
- **The default branch itself.** `catchUpWithMain` fast-forwards it, and
  keeps doing so.
- **Widening the `git` stage.** `gitStageAllowlist` and `reviewGate` are
  untouched; this setting cannot push a commit the server has never seen.
