# Design

## Context

Read on 2026-09-08.

- `AuditEntry` (`security.ts`) carries `runId`, `agent`, `outcome`,
  `cwd`, `timestamp`, and optionally `invocation`, `reason`, `summary`,
  `changeDir`, `usage`, `agentVersion`. There is no `stage` and no
  `effort`.
- Every stage of a chain publishes under the chain's own `runId`
  (ADR 0012), so `runId` groups a chain, never a stage.
- `stepAgents.<stage>.budget` reaches the agent as a CLI flag only:
  `--max-budget-usd` (`agents/claude.ts:33`, `agents/claude-acp.ts:189`)
  and `--max-ai-credits` (`agents/copilot.ts:55`,
  `agents/copilot-acp.ts:34`). No other adapter reads it, and
  `harness-config.ts` rejects the field for agents that have no such
  flag.
- `HarnessChainRunner` writes audit entries only for git actions
  (`recordGitAction`); an agent run is recorded by `agent-runner.ts`.
- `checkBudget` reads this change's own recorded usage and compares it
  against `harnessConfig.budget` before each stage.

## Decision: a per-stage ceiling is checked when the stage ends

A spending ceiling cannot interrupt a running stage — a run's cost is not
known until it ends, which is why the chain ceiling is checked between
stages. A per-stage ceiling inherits that limitation exactly.

So this one is checked **after** a stage completes, against what that
stage reported, and stops the chain rather than the stage. It cannot
prevent the overspend; it prevents the next one.

Stated plainly because the name suggests otherwise. What it buys:

- It exists for every agent that reports usage, where the CLI flag exists
  for two of ten.
- It catches a stage that spent far past what was intended and stops the
  chain before another one does the same.
- Together with the time ceiling from `run-has-a-time-limit` the pair is
  complete: **time cuts a stage mid-run, money stops the chain after
  one.** Neither substitutes for the other, and a reader should not
  expect money to do what only time can.

## Decision: the CLI flag stays, and is not replaced

`stepAgents.<stage>.budget` continues to be passed through untouched.
Where an agent's own CLI can cap an invocation, that cap is better than
anything here: it acts during the run, in the vendor's own accounting,
and it stops the spend rather than reporting it.

The new ceiling is a floor under that, not a replacement — the thing that
exists when the flag does not. Two ceilings on the same stage is not a
conflict: whichever is lower is what binds, and both name themselves when
they fire.

## Decision: `stage` and `effort` on the audit entry, both optional

Optional, for the same reason `changeDir` and `usage` are: an entry
written before the field existed is still a valid entry, and a reader
must be able to tell "not recorded" from "no stage".

An entry with no stage is not backfilled. A stage could be guessed from
timestamps against a chain's event history, and the guess would sometimes
be wrong — a report that quietly invented an attribution would be worse
than one that says the older entries cannot be broken down.

`effort` is recorded because a figure without it is not comparable: the
same stage on the same agent at `high` and at `medium` are different
runs, and a recommendation drawn from history that ignored effort would
average two different things.

## Decision: the chain records the stage, because only it knows

`agent-runner.ts` records the run and does not know which stage of which
chain it is; `HarnessChainRunner` knows and does not currently write an
entry for agent runs.

Rather than teach the runner about stages — it is used for single-stage
runs too, where there is no stage — the chain records the stage against
the entry the runner wrote, keyed by `runId` plus the entry's timestamp
ordering. The alternative, threading a stage through `Command` into the
runner, puts a chain concept into a type that single-stage callers also
use, and the field would be meaningless for every one of them.

## Decision: the cut is recorded here

`run-has-a-time-limit` deferred recording a ceiling cut to this change,
because an entry without a stage could not be attributed to one. With
`stage` present the entry is worth writing, and it is written once, with
the reason the cut already carries.

Double-recording is the thing to avoid: `agent-runner.ts` already records
a `cancelled` outcome when the process is terminated. The chain does not
add a second entry — it records the reason **onto** that outcome, so a
report can tell a ceiling from a person without seeing the same run
twice.

## Rejected: a per-task ceiling

Wanted, and not buildable yet. A stage hands its whole task list to one
agent in one conversation; usage is reported per run. There is no
boundary at which a task's spend could be measured, so there is nothing
to enforce against.

The protection a per-task ceiling is wanted for — a task that turns out
unexpectedly expensive — is what the per-stage ceiling delivers: the
stage carrying that task is what exceeds its bound. What a per-task
ceiling would add beyond that is attribution, and attribution needs the
task to be an execution unit first.

This is deliberately revisited with the change that gives a section of a
task list its own agent, which is where a section becomes a run.

## What this does not decide

The shape of the report that reads all this. Recording `stage` and
`effort` makes a stage-by-stage report possible; what it looks like, and
whether it is offered on a change that never finished, belongs with the
change that builds it.
