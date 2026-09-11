# 0021: Declared Chain Steps

Status: Accepted

Date: 2026-09-11

Extends [ADR-0012](0012-agentic-harness-chain-execution-protocol.md). No
decision there is reversed: the six fixed stages stay fixed, present, and
in order.

## Context

ADR-0012 defined the chain as `propose → review → apply → verify →
archive → git`, one fixed sequence every change runs. A change may say
who runs each stage, with what model, under what ceiling, and whether the
chain pauses between them. It may not say that anything else happens.

That is usually right, and it is what makes one change's run readable to
somebody who has only ever watched another. The case it does not cover is
a change that has to wait on something outside itself. The next change in
this series — parallel changes in git worktrees — is made entirely of
that case: two changes editing one interface need the second to reach
`verify` only after the first has landed. Expressing that today requires
a person to watch two runs and start the second by hand, which is what
this series exists to stop.

There is a second reason to decide it now. `waitForExternalSignal`
(`packages/core/src/external-waiter.ts`) has existed since
`harness-suspendable-stage` with **no consumer** — a poller built for a
caller that never arrived. A capability nothing uses is what this
repository treats as worse than none; it either gets its first consumer
here or it should be deleted.

## Decision

1. **A change's own harness configuration may declare additional steps,
   each positioned relative to a fixed stage.** A declaration is
   `{ step, before | after, param }`: the name of a registry entry, one
   position naming one fixed stage, and whatever that entry requires.

2. **A step names an entry in a closed registry this repository owns. It
   never names something to execute.** This is ADR-0019's line restated
   for a second kind of declaration, and it is what makes the capability
   safe to have at all. A change file is read by a chain that drives
   agents with a working directory and an allowlist; the moment such a
   file can name a command, the allowlist is decoration.
   `prepareAgentContext` holds the same line for prompt content, and the
   mechanical-check registry holds it for checks.

3. **A declaration inserts. It never removes, replaces, or reorders.** A
   change cannot say that `verify` does not happen or that `archive` runs
   first. A run whose stages depend on its own configuration is a run
   nobody can read without opening that configuration first, and the
   shared sequence is the property being protected.

4. **Positions resolve after the chain's resume slice.** The chain
   already starts at the first incomplete stage; steps are inserted into
   that sliced sequence. A step anchored to a stage that already happened
   does not run. A step anchored to the stage the chain resumes at does,
   because reaching that stage is what it was placed before. The one
   backward edge, `verify` returning work to `apply`, re-runs the steps
   between them — they are part of getting from one to the other.

5. **A step is a chain part, not a stage.** `HarnessStage` stays the six;
   `ChainStepName` holds the registry's names; the protocol's `stage`
   field carries the union. One timeline, so no surface learns a new
   event kind and a reader who switches on the six still copes. Adding
   step names to `HarnessStage` itself was rejected — see below.

6. **`steps` is per-change only**, refused in the workspace-wide file
   with its own error, alongside the four existing global refusals. A
   global statement that every chain waits for a named change is a
   statement about changes it knows nothing about.

7. **Waiting is not spending.** A waiting step's duration is not added to
   the chain's elapsed time and is not measured against
   `timeout.maxRunSeconds`. The chain already excludes time spent at a
   checkpoint for a stated reason — a person deliberating is not a run
   consuming anything — and a chain waiting on another chain is that case
   with the person replaced. Each wait carries its own maximum duration
   instead, so a chain never waits forever.

8. **Every declaration is resolved before the first stage runs**, in the
   same preflight ADR-0020 introduced, and for the same reason: a chain
   that discovers a misspelled step name at `verify` has already paid for
   three stages of a run that was never going to finish.

9. **The registry opens with one entry: `await-change`.** It waits until
   a named change is no longer active in the workspace — archived. That
   is the one state visible from the filesystem the two changes share, it
   is what `blocked_by` already resolves on, and it is the point after
   which the other change's specs are where this change's `verify` can
   read them.

## Rejected Alternatives

### A free-form command, filtered by an allowlist

Rejected, and it is the central rejection. It is ADR-0019's own first
rejected alternative, for the same reason: an allowlist over strings
supplied by the file being processed is a filter over attacker-chosen
input, and the file is read by something holding a working directory and
an agent. The registry is a list of functions this repository wrote.

### Add the step names to `HarnessStage`

Rejected: every type derived from `HarnessStage` would gain them, and one
of those derivations — `HarnessStepAgentStage` — is a blocklist
(`Exclude<HarnessStage, "archive" | "git">`). A name added to the union
would silently become a valid `stepAgents` key: a setting nothing reads,
accepted without complaint. The union is split instead, and that
blocklist becomes an allowlist of the four stages that run an agent,
since this change is the growth that makes it dangerous.

### A new pair of events for steps

Rejected: every surface that renders a chain would have to learn them,
and a surface that had not would show a run with a silent gap in it. The
same events, carrying a wider name type, degrade correctly in a reader
that only knows the six.

### Let a step run an agent

Rejected: an agent-driven step is a stage, and the stages are the fixed
six. Every registry entry is something this repository performs itself,
which is also what keeps a step's cost knowable — nothing in the registry
can spend money.

### Open the registry with a plausible set of steps

Rejected: exactly one consumer exists. The mechanical-check registry
opened with six names because six recurring verification sections already
existed to fill them. A second name here with nothing calling it is the
"setting nothing reads" this repository treats as worse than no setting;
it belongs to the change that needs it.

### Detect two changes waiting on each other

Deferred, not rejected on merit: each wait has a maximum duration and
fails naming what it waited for, so a cycle ends rather than hanging.
Cycle detection already exists for the declared `blocked_by` relation,
and connecting the runtime wait to it is its own change.

## Consequences

- The chain's sequence is no longer a constant. A reader of a transcript
  cannot assume six stages, though the events are the same kinds in the
  same order, each naming what it is.
- A chain can sit waiting while holding the workspace lease, so a change
  that waits an hour blocks the other hosts for an hour. The wait's
  maximum duration is the bound, declared in the same file as the wait.
- `waitForExternalSignal` finally has a caller, which settles whether it
  earns its place.
- The parallel-changes work that follows has somewhere to express "this
  change continues once that one lands" without a person in between.
