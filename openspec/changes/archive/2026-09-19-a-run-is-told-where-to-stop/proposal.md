## Why

The owner, on 2026-09-19, wanting to steer a run without interrupting it:
to be able to say "do not do every task, only up to 4.6" while the run
is under way.

Today the only thing an operator can say to a live run is "stop", and it
means "stop at the next sound point". The point they want is further on:
finish 4.6, then stop. The way to get it now is to watch the run and press
Stop at the right second, or to let it run past what was wanted and undo
the rest.

Everything this needs already exists. ADR 0028's channel carries signed
requests to a run by its instance identity, verified against the roster,
fresh, and read at every status renewal. `untilStopBoundary` already knows
the sound points - a marker naming another task, one more task ticked, the
stage's end - and already polls the task list while a stop is pending.
What is missing is a request that says *which* task to stop after.

## What Changes

- **A stop can name the task to stop after.** The request carries a task
  number; the run holds it and stops at the first sound point once that
  task is ticked, or once its agent says it is starting a task beyond it.
- **It is a stop, not a new state.** The run ends cancelled, with the
  reason and the asker, exactly as a plain stop does. Nothing pauses and
  nothing resumes, so nothing holds a lease while doing nothing.
- **Signed, like every request on this channel.** The same envelope, the
  same roster check, the same freshness window on delivery. A request that
  cannot be verified is refused and said in the activity.
- **Recorded.** The chain's ending entry carries the task it was told to
  stop after, beside the reason and the message identifier a stop already
  records.
- **Asked from a terminal and from the editor.** `openspec-ui-cli stop
  <instanceId> --after 4.6 --reason "..."`, and a command on a running
  change's row that asks for the task and the reason.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `execution-core`: a stop request can name the task to stop after, and a
  run honours it.
- `ci-cli`: `stop` takes `--after`.
- `vscode-extension`: a running change can be asked to stop after a named
  task, from its row.

## Impact

- **`packages/core`**: `agent-messages.ts` carries the task in the stop
  envelope; `harness-chain-runner.ts` holds it and converts it into the
  pending stop it already knows how to honour; the audit entry gains the
  task.
- **`packages/cli`**: `stop` takes `--after <task>`.
- **`packages/extension`**: one command, on a change's row.
- **`packages/webui` and `packages/server`**: untouched. The standalone
  Pipeline card's Stop form gains this when the operator's free-text
  message arrives with it, which is the change after this one.

## What this deliberately does not add

**Pause and resume.** The owner named them, and ADR 0028 rejected them
with reasons that still hold: a paused agent keeps its lease and its
working directory while doing nothing, which is exactly the hung agent
the whole design exists to tell apart, and a pause that released the
lease could not promise to resume. `stop-after` answers the case that
prompted this without reopening that decision; reopening it would need an
ADR of its own, and a better argument than convenience.
