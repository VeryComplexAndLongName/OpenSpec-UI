## Why

Observed live on 2026-09-01, twice, with real damage: an `autonomous`
chain run on `tree-command-selection-fallback` **archived a change that
had never been implemented** — 0 of 23 tasks checked, no implementation
in the source. Restored by hand both times.

The first diagnosis was wrong and is recorded here because it wasted a
run: the failure was blamed on the `apply` stage's agent exiting `0`
without doing anything (which `copilot-cli` does do here). It is not
that. **The `apply` stage never ran at all.**

`determineStartStage()` (`harness-chain-runner.ts:79-91`) picks the
chain's first stage:

```ts
const proposeDone = isDone("proposal") && isDone("design") && isDone("tasks");
if (!proposeDone) return "propose";
if (status.progress.remaining > 0) return "apply";
return "archive";
```

`openspec status --change <name> --json` returns **no `progress` field**
for this change — verified directly. `normalizeStatusResult()`
(`openspec.ts:349-357`) then synthesizes one:

```ts
const complete = value.artifacts.filter((a) => a.status === "done").length;
const total = value.artifacts.length;
progress: { total, complete, remaining: total - complete }
```

Those artifacts are `proposal`/`specs`/`design`/`tasks`, and `"done"`
there means **the file exists**, not that the work is finished. A change
with all four files written and every task unchecked therefore reports
`remaining: 0`, and the chain goes straight to `archive`.

Two distinct meanings of "done" share one field name, and the chain reads
the wrong one at the one point where the decision is irreversible.

## What Changes

- `packages/core/src/openspec.ts`: stop synthesizing `progress` from
  artifact presence. When the CLI reports no task progress, say so —
  `progress` becomes optional on the result rather than a fabricated
  zero-remaining value that cannot be told apart from a real one.
- `packages/core/src/harness-chain-runner.ts`, `determineStartStage()`:
  decide `apply` vs `archive` from the change's actual task checkboxes,
  not from artifact presence. When task progress cannot be determined at
  all, choose `apply` — never the irreversible stage.
- `packages/core/src/harness-chain-runner.ts`: before archiving, refuse
  when any task remains unchecked, failing the chain with the count.
  A stage's successful termination is not evidence the change is ready:
  an agent process can exit `0` having changed nothing, which
  `copilot-cli` demonstrably does here.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `agentic-harness`: a chain determines its start stage and its
  permission to archive from actual task completion, and refuses to
  archive a change whose tasks are incomplete.
- `execution-core`: a status result no longer claims task progress it
  does not have.

## Impact

- `packages/core/src/openspec.ts`,
  `packages/core/src/harness-chain-runner.ts`, and their tests.
- Every existing caller of `statusChange()` that reads `progress` must
  handle its absence — the Processes view's percent-complete is the one
  to check.
- Consequence worth stating up front: a chain will now stop before
  `archive` for any change carrying a human-only task, because an agent
  cannot check one. That is intended — the chain hands back to the person
  who can verify it, which `openspec/config.yaml`'s archive guidance
  already requires.
