## Why

Reported by a user on 2026-09-24, from a change with 65 of 66 tasks done:
"I don't know what the pipeline will do when I hit any of the buttons in
the Start window. Does it continue with apply?"

The run dialog could not say. It described the chain as "Runs propose,
review, apply and verify in sequence", though a chain on that change
resumes at apply, skipping review. And with the user's autonomy level,
`assisted`, it offered "Run the chain", which the runner refuses the
moment it starts: "start each stage individually instead of running a
chain". A button that only fails is a button that does nothing.

## What Changes

- **The dialog says where a run begins, and why**: "Continues at apply: 1
  task still open.", "Starts at propose: there is no proposal and task list
  yet.", "Continues at verify: every task is done." Said wherever the host
  can read the change's files, in both hosts.
- **One function decides it.** `runStartStage` in core is what the chain
  runner resumes from, and what the dialog states, so the two cannot
  disagree. The runner's own rule is unchanged: propose until there is a
  proposal and a task list, apply while a task is open or the count is
  unknown, verify once every task is closed.
- **No chain under `assisted`.** It is left out of the paths offered, and
  the dialog says instead that a chain is not offered, why, and that
  Semi-autonomous offers one. The scheduled path loses it too, since a
  scheduled chain would be refused the same way.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `agentic-harness` - what the run entry offers and says about where a run
  begins.

## Impact

- `packages/core/src/run-plan.ts`: `runStartStage`, `describeRunStart`,
  `runStartFactsFrom`, and the plan's `startsAt` and `withheld`;
  `harness-chain-runner.ts` decides with `runStartStage`; the browser
  entry exports them.
- `packages/webui/src/components/RunDialog.tsx` and
  `run-with-harness-dispatch.ts`; `packages/extension/src/commands.ts`.
- One requirement in `openspec/specs/agentic-harness/spec.md`.

## Explicitly out of scope

- **Which stage "Run one stage" preselects.** Its picker is its own; the
  sentence above says where the change stands.
- **Review on resume.** A chain resuming after propose starts at apply, as
  it did; the dialog now says so rather than changing it.
