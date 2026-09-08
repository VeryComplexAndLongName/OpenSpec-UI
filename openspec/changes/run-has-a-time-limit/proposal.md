## Why

A harness run can take forever, and nothing will stop it.

`LIMITS.md` states this outright, in a section written because someone
asked about time limits as though one existed: "There is no wall-clock or
duration limit on a harness run, and no per-stage timeout. A chain, and
each of its stages, can run indefinitely." The only way to end one is a
person sending `cancel`.

The two ceilings that do exist are money and tokens, and both share a
property that makes this worse than it sounds: they can only stop the
**next** stage from starting, never the one already running, because a
run's cost is not known until it ends. So the mechanism that could act on
a stuck stage does not exist, and the mechanisms that exist cannot act on
one.

And they count only what an agent reported. Six of the ten agents this
project supports — `claude-cli`, `copilot-cli`, `codex-cli`, `gemini-cli`,
`local-llm`, `vscode-chat` — report nothing at all, so no ceiling of any
kind is in force over them today. A chain running on any of those is
bounded by nothing.

Elapsed time is different from cost in exactly the way that matters: it
is known **during** a run. So it is the one ceiling that can stop a stage
that has stopped making progress, and the only one that works on an agent
that reports nothing.

This is not hypothetical here. A chain on `copilot-cli-acp` sat waiting
on a permission request nobody could answer, for ten minutes, until a
person noticed and killed it — the failure `chain-answers-a-permission-request`
fixed. The fix removed that cause; it did not give a run any way to end
itself when the next cause appears.

## What Changes

- A time ceiling on a whole chain and on a single stage, both optional,
  configurable globally and per change.
- Reaching one stops the run as **cancelled, with the reason stated** —
  not failed. Stopped by a rule is not the same as broken, and the
  distinction is what tells a reader whether to investigate.
- A stage that was cut may be attempted again, bounded by a stated number
  of attempts. The attempt count is one number, shared with the other
  reasons a stage is retried, so that reasons cannot multiply into runs
  nobody asked for.
- What has been spent against the ceiling is visible while the run is
  going, beside what it has spent in money and tokens.

## Capabilities

### Modified Capabilities

- `agentic-harness`: a run can be bounded in time, ends by rule rather
  than by breaking, and can be attempted again a stated number of times.

## Impact

- `packages/core`: `harness-config.ts` (the new fields and their
  validation), `harness-chain-runner.ts` (arming the ceiling, cutting a
  stage, counting attempts), `protocol.ts` (a reason on the cancelled
  event). `packages/webui` for the elapsed row. Changeset for `core`,
  `webui` and both hosts.

## Explicitly out of scope

- **Making money or tokens interrupt a running stage.** That remains
  impossible for the recorded reason: the figure does not exist until the
  run ends. Time is being added precisely because it does not share that
  property.
- **Retrying for reasons other than a cut.** `verify` unchecking a task
  is a separate change, which will use the attempt counter this one
  establishes rather than introducing a second.
- **A default time limit.** Absent stays absent, meaning unbounded, as
  every configuration written before this field existed already means.
  Choosing a number for everyone is a different argument, and a wrong
  default here cancels work people wanted.
