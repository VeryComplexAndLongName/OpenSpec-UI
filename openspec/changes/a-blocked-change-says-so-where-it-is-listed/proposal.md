## Why

DW reported on 2026-09-18 that the Changes view and the Change Graph say
different things about the same change: the list marked
`application-lifecycle-completion` ready while the graph showed it blocked
by `apply-plan-stays-pending`, which was still active. They sent the
screenshot that shows both at once.

The graph is right, and so is the CLI: `readChangeReadiness` reads
`blocked_by`, keeps the blockers that are still active, and returns
`run.state === "blocked"`; `openspec-ui-cli ready` passes that fact to
`describeChangeState` and prints Blocked.

The two Changes views do not pass it. `packages/webui/src/standing-states.ts`
and `packages/extension/src/tree/changes-tree.ts` both call
`describeChangeState({ standing })` with no `readiness`, and core's word
list only ever considers Blocked when that field says so — so every change
that is not finished falls through to Ready, whatever order the workspace
declares.

The result is worse than a missing word. The list is where a person decides
what to start next, and it was telling them to start something the product
knows cannot proceed.

## What Changes

- **Both Changes views read readiness and pass it.** The standalone list and
  the editor's Changes tree ask core for the same readiness the Pipeline
  already reads, and hand it to `describeChangeState`.
- **Blocked is stated with what blocks it.** The word carries the blockers'
  names, so the list answers "blocked by what" without opening the graph.
- **A finished change that is still blocked says both.** Where every task is
  ticked and an active change still blocks it, Done stays the word and
  Blocked is stated beneath it, rather than one of the two facts being
  dropped.
- **A test covers the pair.** The list and the graph are read from the same
  workspace in one test, and the test fails where they disagree.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-ui`: wherever a change is listed, its state word accounts for the
  order the workspace declares.

## Impact

- **`packages/core`**: `change-state-word.ts` states Blocked with its
  blockers and keeps it beside Done; `change-readiness.ts` is unchanged.
- **`packages/webui`**: `standing-states.ts` takes the readiness reading;
  `standalone-entry.tsx` passes the one it already loads.
- **`packages/extension`**: `tree/changes-tree.ts` reads readiness with its
  standings.
- **Unchanged**: the Change Graph, the Pipeline, the CLI's `ready` command,
  and what `blocked_by` means.
