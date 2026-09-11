# Design

## Decision: a step is a name in a closed registry, never a command

A declared step is `{ "step": "await-change", "before": "verify",
"param": "the-other-change" }`. The `step` field selects an entry in a
registry `packages/core/src` owns; the entry is a function this
repository wrote. Nothing in a change's file is ever executed.

This is ADR 0019's line, restated for a second kind of declaration, and
it is the whole reason the capability is safe to have. A change file is
read by an agent-driving chain with a working directory and an
allowlist; the moment it can name something to run, the allowlist is
decoration. `prepareAgentContext` holds the same line for prompts, and
the mechanical-check registry holds it for checks.

## Decision: a declaration inserts, it never removes or reorders

The six fixed stages stay fixed, present, and in that order. A
declaration says only that something additional happens at a stated
point.

The sequence a chain runs is what makes one change's run readable to
somebody who has only watched another. A change that could delete
`verify` would be a change whose run means something different from
every other run, and a reader would have to open its configuration
before they could believe its transcript.

## Decision: position is relative to a fixed stage, and resolved after resume

`before` or `after`, naming one fixed stage. Exactly one of the two.

The chain already resumes at the first incomplete stage rather than
always starting at `propose`, so the sequence is sliced before steps are
inserted. A step anchored to a stage that is not in the sliced sequence
does not run: it is anchored to work that already happened. A step
anchored to the stage the chain resumes at does run, because reaching
that stage is exactly what it was placed before.

The one backward edge — `verify` sending work back to `apply` — re-runs
the steps between them. That is correct rather than incidental: they are
part of getting from `apply` to `verify`, and a wait that was needed the
first time is needed again.

## Decision: a step's name is a chain part, not a stage

`HarnessStage` stays the six. A new `ChainStepName` holds the registry's
names, and the protocol's `stage` field carries `ChainPart`, the union of
the two. One timeline, so every surface that already renders
`stageStarted`/`stageCompleted` renders a step with no new event kind to
learn, and a reader who switches on the six still handles them.

The alternative — adding step names to `HarnessStage` — puts them inside
every type derived from it, and one of those derivations is a blocklist.

## Decision: the stage-agent list becomes an allowlist

`HarnessStepAgentStage` is `Exclude<HarnessStage, "archive" | "git">`. It
is a blocklist over a union that is about to grow, so any name added to
that union silently becomes a valid `stepAgents` key — a setting nothing
reads, accepted without complaint. It becomes the four stages that run an
agent, named.

Worth doing here rather than later: this change is the growth that makes
the latent problem real, and the file's own comment already warns that
keeping these cases in one place is what stops their removal turning into
six subtly different call sites.

## Decision: `steps` is per-change only

The global `openspec/agent-harness.json` may not set it, with its own
error type alongside the four that exist.

A global statement that every chain waits for a named change is a
statement about changes that have nothing to do with it — the same
reasoning that makes `taskAgents` per-change, and enforced the same way
rather than by a comment asking people not to.

## Decision: waiting is not spending

A step that waits does not add to the chain's elapsed time, and its
duration is not measured against `timeout.maxRunSeconds`.

The chain already excludes time spent at a checkpoint, for a stated
reason: a person deliberating is not a run consuming anything, and
counting it would fire the ceiling on chains behaving exactly as
configured. A chain waiting for another change to land is the same case
with the person replaced by another chain. Counting it would mean the
correct configuration is the one that fails.

The wait has its own maximum duration instead, so a chain never waits
forever, and exceeding it fails the chain saying what it was waiting for.

## Decision: the registry opens with one entry

`await-change`: wait until the change named by `param` is no longer an
active change — it has been archived. Polling through
`waitForExternalSignal`, which is what that module was written for and
has had no caller until now.

One entry rather than a plausible-looking set. The mechanical-check
registry opened with six because six recurring verification sections
already existed to fill them; here exactly one consumer exists, and a
second name with nothing calling it is the "setting nothing reads" this
repository treats as worse than no setting.

Archived, specifically, rather than merged or reviewed. It is the one
state that is visible from the filesystem of the workspace both changes
share, it is the state `blocked_by` already resolves on, and it is the
point after which the other change's specs are in `openspec/specs` where
this change's `verify` can read them.

## Decision: every declaration is checked before the chain starts

`resolveChainStart` grows a check: each declared step names a registry
entry, states exactly one position, names a fixed stage, and carries
whatever its entry requires. A step naming its own change is refused,
since a change cannot wait for itself.

Same reasoning as the agent check that change added: a chain that
discovers a misspelled step name when it reaches `verify` has already
spent `propose`, `review` and `apply` on a run that was never going to
finish.

Deliberately not checked up front: whether the change a step waits for
exists. It may legitimately not exist yet — that is the case the wait is
for — and refusing on it would make the declaration useless for the
schedule it describes.

## Non-Goals

Detecting that two changes wait on each other. Each wait has a maximum
duration and fails saying what it waited for; cycle detection lives with
`blocked_by`, which already has it, and joining them is its own change.

A step that runs an agent. Every registry entry is something this
repository performs itself. An agent-driven step is a stage, and stages
are the fixed six.

## Risks / Trade-offs

A chain can now sit waiting for a long time, holding the workspace lease
while it does. That is correct — it is still the run that owns the
workspace — but it means a change that waits an hour blocks the other
hosts for an hour. The wait's maximum duration is the bound, and it is
declared in the same file as the wait.

The sequence is no longer a constant, so a reader of a transcript cannot
assume six stages. Mitigated by the events being the same kinds, in
order, each naming what it is: the transcript gains a line rather than
changing shape.
