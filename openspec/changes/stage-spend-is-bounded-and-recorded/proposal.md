## Why

Nothing this project enforces bounds one stage's spending, and nothing
recorded says which stage spent what.

`stepAgents.<stage>.budget` looks like a per-stage ceiling and is not one
of ours. It is passed straight through as a flag to the chosen CLI —
`--max-budget-usd` for `claude`, `--max-ai-credits` for `copilot` — so it
exists only where that CLI has such a flag. For `codex-cli`,
`gemini-cli`, `local-llm` and `vscode-chat` the field is rejected
outright, and those stages run with no spending bound of any kind.

The second half is worse for anyone trying to understand a finished run.
An audit entry carries `runId`, `agent`, `outcome`, `usage` and
`changeDir` — and no stage. Every stage of a chain runs under the chain's
own `runId` (ADR 0012), so a report built from the audit log can say what
a change cost in total and cannot say what `apply` cost. The live panel
shows a row per stage only because it reads the event stream, which is
gone once the run is over.

Effort is missing for the same reason and matters for the same question:
a stage run at `high` and one at `medium` are not comparable, and the
record does not say which happened.

This blocks the report a person actually wants — "what did this change
cost, stage by stage" — and it blocks recommending a budget from what
similar changes really cost, because the history cannot be broken down.

It also leaves a deferred task from `run-has-a-time-limit` unfinished:
recording that a stage was cut by a ceiling, which was held back
precisely because an entry with no stage could not be attributed.

## What Changes

- An audit entry records the stage it belongs to and the effort the agent
  was asked for.
- A ceiling on one stage's reported spend, enforced by this project
  rather than by the agent's CLI, so it exists for every agent that
  reports usage at all.
- A stage cut by a time ceiling is recorded with the reason, completing
  the task `run-has-a-time-limit` deferred here.

## Capabilities

### Modified Capabilities

- `agentic-harness`: what a stage spent is recorded against that stage,
  and a stage's spend can be bounded by this project rather than only by
  the agent's own CLI.

## Impact

- `packages/core`: `security.ts` (two fields on the audit entry),
  `harness-chain-runner.ts` (recording them, and the new check),
  `harness-config.ts` (the ceiling). Changeset for `core`.

## Explicitly out of scope

- **A ceiling on one task.** A stage hands its whole task list to one
  agent in one conversation, and usage is reported per run, so there is
  nothing to attribute to a single task and nothing to enforce against
  it. This is deliberately revisited once a section of a task list has a
  run of its own — the change that gives a section its own agent — and
  the protection a per-task ceiling was wanted for is what the per-stage
  ceiling delivers today.
- **Making a spending ceiling interrupt a running stage.** It cannot, for
  the reason already recorded: a run's cost is not known until it ends.
  The per-stage ceiling here is therefore checked when a stage ends and
  stops the chain; the ceiling that cuts a stage mid-run is the time one.
- **Backfilling stages onto entries already written.** An entry written
  before this field existed does not know its stage, and guessing one
  from timestamps would invent a record. Absent stays absent, and a
  report says so.
