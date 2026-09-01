## Why

Specific risk raised in review on 2026-09-01, on the run that produced
`harness-chain-archive-gate`. `rules.tasks` already says (rule 6, from
`openspec/changes/archive/2026-09-01-task-granularity-rules/`) that a
task an implementing agent cannot perform must say so and be reported
outstanding. It does not say what the agent should *do* when it reaches
one, and the two readings differ in a way that decides whether an
unattended run finishes at all:

- **Skip and keep going** — the run completes, and the human-only task
  is reported unchecked at the end.
- **Stop and wait for the human** — the run parks forever. Nothing in
  the harness is listening: `apply` runs headless under
  `--dangerously-skip-permissions`/`--allow-all-tools` precisely because
  there is no interactive surface, and a chain under `autonomous` has no
  confirmation channel at all. A stage that waits does not pause; it
  burns its budget and is killed.

Runs here have already shown the second reading in practice. Agents
reaching a live-smoke-test task have produced trailing prose asking to
be told the result, in a stream nobody reads until the process exits.

The harness already owns the blocking mechanism, and it is not task
text. `autonomyLevel: "assisted"` refuses to chain at all and requires
each stage to be started by hand; `semi-autonomous` (the default) pauses
between stages on a `checkpoint` event that a human resolves with
`confirmCheckpoint()`. Both are configuration a human sets before the
run, visible in the UI, resumable, and cancellable —
`HarnessChainRunner` implements exactly this. A pause improvised inside
`tasks.md` has none of those properties: the runner does not know the
stage is waiting, the Processes view still shows it running, and there
is no control that resumes it.

So the rule has to state both halves: the agent always skips and
reports, and an author who genuinely needs the run to stop expresses
that through the autonomy level rather than by writing a task that asks
the agent to wait.

## What Changes

- `openspec/config.yaml`, `rules.tasks`: one rule appended alongside the
  eight already there, stating that
  1. an implementing agent SHALL skip a human-only task, continue with
     the remaining tasks, and report it outstanding — it never waits for
     a human inside a run; and
  2. an author who needs the run to block must express that through
     `autonomyLevel` (`assisted`, or `semi-autonomous` with
     `checkpoints.requireConfirmationBetweenSteps`), not through task
     text.
- Rule 6 (`a task an implementing agent cannot perform ... must be
  reported as outstanding rather than checked off`) is left untouched;
  the new rule states the behavior that rule leaves open, and both are
  needed.
- No change to `rules.proposal`/`rules.design`, to `context`, or to any
  `operations.*` guidance.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — process/authoring rules, no product-facing behavior;
`.openspec.yaml` sets `skip_specs: true` accordingly)

## Impact

- `openspec/config.yaml` only.
- No `packages/*` source change and no changeset (tooling/process only),
  matching the precedent set by
  `openspec/changes/archive/2026-09-01-task-granularity-rules/`.
- Reaches every implementing agent, including the `copilot`/`codex` CLIs
  that never read `CLAUDE.md`, because `openspec instructions` returns
  `rules.tasks` mechanically before any propose/apply call.
