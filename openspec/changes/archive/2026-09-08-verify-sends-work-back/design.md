# Design

## Context

Read on 2026-09-08.

- `runMechanicalChecksForVerify` writes each declared check's result onto
  its own task's checkbox, and is the only writer of those checkboxes. A
  failing check unchecks the task.
- The stage loop walks `CHAIN_STAGES.slice(indexOf(startStage))` forward
  with `index += 1`. There is no path backward.
- `archive` refuses while any task is unchecked, naming the count.
- `determineStartStage` already decides where to enter a chain with
  `tasks.unchecked > 0 ? "apply" : "verify"`.
- `run-has-a-time-limit` added `maxStageAttempts` and an attempt loop
  around a single stage, with `stageStarted` carrying `attempt` and
  `previousAttemptReason`.

## Decision: the chain returns to `apply`, and nowhere else

`verify` is the only stage that produces a machine-checked statement that
earlier work is unfinished, and `apply` is the stage that does that work.
Every other backward move would be a guess about what went wrong.

This is not "step back one stage" in general, which `HARNESS.md` records
as deliberately absent. It is one edge, from one stage, on one condition
the machine can evaluate: tasks are unchecked.

## Decision: it reuses the attempt counter rather than adding a ceiling

`maxStageAttempts` was defined in `run-has-a-time-limit` specifically so
that this change would consume it. The alternative — a
`maxVerifyReturns` beside it — is what that design rejected: two ceilings
of three become nine runs of `apply` that nobody configured.

So a return counts as an attempt of `apply`, against the same number, and
records its reason the same way a time cut does. The panel shows "apply,
attempt 2" with the reason beside it, whichever cause produced it.

Because attempts default to one, **a chain that configures nothing
behaves exactly as it does today**: `verify` unchecks, `archive` refuses,
the chain fails. The return is something a person turns on, and the
failure it replaces is still what happens when they have not.

## Decision: attempts are counted per stage, not per chain

A chain that returns to `apply` twice and is then cut once at `verify`
has used two attempts of one stage and one of another. Counting them
together would let a slow `verify` consume the allowance meant for
`apply`.

So the tally is per stage. This is a change to the shape
`run-has-a-time-limit` introduced, where the counter was local to one
loop iteration — a returning chain re-enters that iteration, so the count
has to outlive it.

## Decision: a chain that did not run `apply` does not return to it

A chain resumed directly at `verify` has no `apply` in its sequence. The
honest options are to prepend one or to stop.

Stop, and say so. A chain entered at `verify` was entered there because
someone — `determineStartStage` or a person — judged the work done;
silently running `apply` in a chain that was never asked to would be the
chain doing something nobody requested. The message names the unchecked
tasks, which is what a person needs either way.

## Decision: what the stop says names the tasks

Today's refusal names a count: "2 task(s) still unchecked". Once the
chain has spent its attempts trying to fix them, a count is not enough —
the reader is about to take over, and they need to know which two.

So the terminal message lists them. This is the one piece of information
that is expensive to get by hand at exactly the moment it is needed, and
it is already loaded: `countTasks` reads the file the message would
otherwise send someone to open.

## Rejected: looping until the tasks are checked

A task can be unfinishable by any agent — a human-only item, a check
whose parameter is wrong, a test that fails for a reason the agent cannot
see. Without a bound the chain would run `apply` until a budget or a time
ceiling stopped it, which is the most expensive possible way to discover
that a person is needed.

## Rejected: returning on any unchecked task, including ones never checked

Considered and kept simple deliberately: the condition is "tasks are
unchecked after `verify` ran", not "verify unchecked something it had
previously seen checked". Distinguishing them means remembering the
before state, and the two cases call for the same action — `apply` has
work to do either way. The simpler condition is also the one `archive`
already refuses on, so the chain and the refusal agree about what
"finished" means.

## What this does not decide

Whether a returning chain should re-run the stages between `apply` and
`verify` — there are none today, since they are adjacent. If a stage is
ever inserted between them, whether it repeats is a question that change
must answer.
