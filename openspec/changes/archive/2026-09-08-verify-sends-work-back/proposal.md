## Why

The chain can discover that a task is not done, and then has nowhere to
put that discovery.

`verify` runs each task's declared mechanical check and writes the result
onto that task's own checkbox — the only writer of those checkboxes, and
the reason an agent's own claim never reaches them. A check that fails
**unchecks** the task.

The chain then walks forward into `archive`, which refuses:

```
cannot archive "<change>": 2 task(s) still unchecked;
complete or verify them, then archive
```

So the sequence is: the machine detects that work is unfinished,
correctly, and then stops with an error instead of finishing it. A person
reads a failed chain, opens the change, sees two unchecked tasks, and
starts `apply` by hand — which is exactly what the chain would have done
had it been allowed to.

The decision is already written down elsewhere in the same file.
`determineStartStage` picks where a chain begins with
`tasks.unchecked > 0 ? "apply" : "verify"` — the rule exists, it is
simply not applied to a chain already running.

`run-has-a-time-limit` built the counter this needs: one number bounding
how many times a stage may be attempted, with each attempt recording why
the previous ended. It was defined there deliberately so that this change
would consume it rather than introduce a second ceiling that multiplies
against the first.

## What Changes

- Where `verify` leaves tasks unchecked and `apply` has attempts
  remaining, the chain returns to `apply` instead of failing at
  `archive`.
- The return is bounded by the existing `maxStageAttempts` and records
  why it happened, so a reader sees "apply, attempt 2 — verify left 2
  tasks unchecked" rather than the same stage twice with no explanation.
- Where the attempts are used up, the chain stops and names the tasks
  that are still unchecked — the information a person needs in order to
  take over, which today they get only by opening the file.

## Capabilities

### Modified Capabilities

- `agentic-harness`: a chain acts on its own verification result instead
  of failing at the next stage.

## Impact

- `packages/core/src/harness-chain-runner.ts`. Changeset for `core`.

## Explicitly out of scope

- **Returning from any other stage.** `verify` is the only stage that
  produces a machine-checked statement that earlier work is unfinished.
  A general "step back one stage" control is a different thing, and
  `HARNESS.md` records why a chain runs forward only.
- **A second ceiling.** The attempt count from `run-has-a-time-limit` is
  the ceiling. Adding one for this reason specifically is what that
  change's design already rejected: separate ceilings multiply.
- **Changing what `verify` checks.** This changes what the chain does
  with the answer, not how the answer is produced.
- **Retrying a task an agent cannot do at all.** The bound exists because
  some tasks will not be completed by any number of attempts, and the
  chain must hand those to a person rather than loop.
