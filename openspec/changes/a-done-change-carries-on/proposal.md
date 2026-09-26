## Why

Feedback from DW on 2026-09-26, on 0.88.2, forwarded by the owner:

- A change whose every task was ticked offered no way on. Its card said
  Done and drew no Start, so the chain never reached `verify`, `archive`
  or `git`; DW archived by hand. The run dialog already knows what such a
  run does ("Continues at verify: every task is done"); the card never
  offered it.
- DW took the `review` stage for a review of the implementation, and asked
  whether it would read a reviewer definition. It reviews the proposal,
  before `apply`; the implementation is checked by `verify`. Nothing on
  screen says which stage checks what.
- DW looked for "propose" in the command list and found `plan`, which is
  what the `propose` stage sends, with nothing saying so.

And from the owner on 2026-09-27: a stage that is not wanted should be
possible to leave out. `review` is the one asked for; with no agent set,
it runs on the host's default agent rather than not at all.

## What Changes

- A card whose every task is done offers Start. The run dialog it opens
  already says the run continues at `verify`.
- Every place that names a stage says what it checks: the Harness
  Settings stage table, and the run dialog's list of what runs each stage.
  `review` reads "reviews the proposal, before apply"; `verify` reads
  "checks the implementation, after apply".
- The command list says what each command does, and that `plan` is what
  the `propose` stage sends.
- A new harness key, `skipStages`, leaves stages out of a chain. It
  accepts `review` only. The chain says on its timeline that it skipped
  one, the run dialog lists it as skipped, and core's findings stop
  judging a stage that does not run. A declared step placed against a
  skipped stage is refused where the configuration resolves.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui` - a Done card offers Start; stages and commands say what
  they do.
- `agentic-harness` - `skipStages`; the fixed stages stay fixed except
  where `skipStages` leaves one out.

## Impact

- `packages/core`: `harness-stage.ts` (skippable stages, stage and command
  purposes), `harness-config.ts`, `harness-config-schema.ts`,
  `harness-config-findings.ts`, `harness-chain-runner.ts`, `run-plan.ts`,
  `browser.ts`, `index.ts`, with their tests.
- `packages/webui`: `PipelineView.tsx`, `RunDialog.tsx`, `AiPanel.tsx`,
  `harness-settings-parts.tsx`, both Harness Settings views, with their
  tests.
- `packages/extension/schemas/*.schema.json`, regenerated.
- `HARNESS.md`, and an amendment to ADR 0012.

## Explicitly out of scope

- **Moving `review` after `apply`.** Rejected in `harness-verify-stage`:
  `verify` is the review of the implementation, and moving `review` would
  silently change what every existing `stepAgents.review` does.
- **Skipping any stage but `review`.** `propose` is already left out when
  the proposal is written; `verify` is the only check that `apply` did the
  work it ticked; `archive` and `git` are governed by the task gate and
  `reviewGate`.
- **A Skip switch in the Harness Settings views.** They show the skip; it
  is set in the file. A switch can follow.
- **The `plan` instruction itself** ("Draft an implementation plan ...
  without changing code"), which does not tell the `propose` stage to
  write `proposal.md` and `tasks.md`. Its own change.
