# Design

## Context

Read on 2026-09-08. Line numbers are from that read.

- `HarnessChainRunner.cancel(runId)` (`harness-chain-runner.ts:330`)
  already does everything a cut needs: it sets `cancelRequested`,
  resolves a pending checkpoint, and re-sends a `"cancel"` command to the
  stage's own runner, which terminates the spawned process tree. A
  timeout needs no new way to stop anything.
- `ChainState` (`:97-102`) holds `cancelRequested`, `pendingCheckpoint`,
  `currentRunner` and `currentCommand`. It has no notion of when
  anything started.
- `CancelledEvent` (`protocol.ts:195-197`) carries no reason. A run
  cancelled by a person and one cut by a ceiling are indistinguishable
  on the stream.
- `HarnessConfig.budget` (`harness-config.ts:93`) is the precedent for an
  optional ceiling: absent means unlimited, and a per-change file may set
  one that a global file does not.
- The chain's stage loop (`:476`) walks `CHAIN_STAGES` forward with no
  way back, and `runChain` awaits each stage's `run()` to completion.

## Decision: time cuts a running stage; money and tokens still do not

The recorded reason budget is checked only between stages is that a
run's cost is not known until it ends (ADR 0018 decision 7). Elapsed time
does not share that property — it is known continuously — so the
argument for deferring does not transfer, and applying it anyway would
produce a ceiling that cannot stop the thing it exists to stop.

So: a stage that exceeds its ceiling is cut where it stands, by calling
the same `cancel` path a person's click uses.

This also makes it the only ceiling with any force over the six agents
that report no usage. For those, it is not a better ceiling than money
and tokens — it is the only one.

## Decision: the clock runs while the agent runs, and not otherwise

A chain waiting at a checkpoint for a person to confirm is not spending
anything, and a person thinking is not a runaway run. If the clock ran
there, the ceiling would punish deliberation and fire on chains that were
working exactly as designed — the semi-autonomous level exists to insert
those pauses.

So elapsed time accumulates while a stage's `run()` is in flight, and
stops at a checkpoint. The chain ceiling is the sum of what its stages
spent, not wall-clock from start to finish.

This matters for the `git` stage too, which polls a pull request's checks
for up to five minutes (`gh-pr-gateway.ts`'s `maxWaitMs`). That wait is
the stage doing its work, so it counts — but a chain ceiling below five
minutes would cut `git` mid-poll, which the documentation should say
rather than leave someone to discover.

## Decision: cut work is left in place, not rolled back

A stage cut partway has changed some files. The alternatives are to leave
them or to restore the checkpoint taken before the stage.

Leave them. An agent cut at ninety per cent of its work has produced
something the next attempt can continue from, and rolling that back
guarantees the same time is spent again from nothing. The failure mode of
leaving it — a half-applied change — is the same state a crash or a
person's cancel already produces today, and the checkpoint remains
available for a person who wants it undone.

Stated because it is the decision most likely to be reversed by someone
who has not thought about the cost of the alternative.

## Decision: cancelled, with a reason

The outcome is `cancelled`, not `failed`. A ceiling doing its job is not
a defect, and reporting it as one trains people to ignore failures.

But `cancelled` alone is not enough: a reader seeing it needs to know
whether a person clicked or a rule fired, and today the event cannot say.
So `CancelledEvent` gains an optional reason, and a cut names the ceiling
it hit and the value it hit — the same posture `checkBudget` already
takes when it stops a chain by naming the budget rather than blaming a
stage.

Optional, not required: every cancel written before this field existed
means "a person asked", and an absent reason keeps meaning that.

## Decision: one attempt counter, not one per reason

A stage can be attempted again after being cut. A stage will also, in a
later change, be attempted again after `verify` unchecks one of its
tasks. If each reason carries its own limit, three of one and three of
the other multiply into nine runs of `apply` that nobody configured.

So there is one number — the attempts a stage may have — and each
attempt records why it happened. The panel can then say "apply, attempt 2
of 3 (previous: time limit 5:00)", which is the sentence a person needs,
and the ceiling stays one number.

`maxStageAttempts` is defined here, in the change that first needs it,
and consumed unchanged by the retry-on-unchecked change that follows.

## Decision: absent means unbounded

No default limit. Every configuration written before these fields existed
means unbounded today, and a default would silently start cancelling work
those configurations were producing.

A default is also unknowable from here: a `verify` on a small change is
seconds, an `apply` on a large one has taken tens of minutes legitimately.
Any number picked centrally is wrong for one of them.

## Rejected: killing the process directly instead of going through cancel

`cancel` terminates the process tree, resolves a pending checkpoint, and
sets the flag the loop reads to stop advancing. A timeout that killed the
child directly would reproduce two of those three and get the third
wrong, and the difference would show up as a chain that keeps walking to
the next stage after its current one was killed.

## Rejected: a single wall-clock limit on the whole chain only

It would be simpler and would not answer the case this exists for. A
chain of four stages where one hangs looks, to a whole-chain ceiling,
exactly like a chain doing a lot of work — the ceiling fires far too late
or not at all, depending on the number. The per-stage limit is the one
that catches a stuck stage; the chain limit catches a chain that is
merely too expensive in aggregate. They answer different questions and
both are cheap.

## What this does not decide

Whether a cut stage should be attempted again **automatically**, or only
when a person asks. This change gives the attempt a ceiling and a
recorded reason; whether the chain retries on its own is bound up with
the autonomy level, and belongs with the retry-on-unchecked change that
uses the same counter.
