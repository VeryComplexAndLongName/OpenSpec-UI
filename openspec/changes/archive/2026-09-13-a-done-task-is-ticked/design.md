# Design

## Decision: the instruction to tick belongs to the product

The chain's own archive step refuses a change with an unticked task. The
product that enforces that gate is the one that has to tell its agents
how the gate is met. Leaving it to a project's rules makes the chain
depend on a setting nobody knows is load-bearing: this repository has the
rule, a fresh `openspec init` does not, and nothing tells the person why
their chain never archives.

Stating it in the product's instruction as well as in a project rule
costs nothing — both say the same thing — and a project may still add to
it.

## Decision: verification may tick

The alternative was to keep verification untick-only and make the
implementing stage the only one that ticks.

Rejected, on what was observed. An implementing run ends without ticking
for ordinary reasons: a model that did not think to, a session that ended
while its tests ran in the background. Verification is a separate agent
whose whole job is to check the work against the tasks. A tick it gives
after confirming a task is the strongest tick a chain can produce;
forbidding it makes archiving depend on the weakest one.

The risk is a verifying agent ticking what it did not check. It is
bounded three ways:

- the instruction ties a tick to verification the agent confirmed
  itself, not to the implementing run's say-so;
- a task marked `**Human-only**` or `**Delegated to …**` is never ticked
  by it — those have their own closing rules, and a delegated item's
  evidence rule already exists precisely because an agent asked to confirm
  that something works will confirm it;
- declared mechanical checks keep ticking and unticking their own tasks,
  and still run before the verifying agent does.

## Decision: an effect that is not a file is still an effect

The verifying agent is given the files the implementing run changed. A
task whose effect is a command that must pass, or a condition that must
hold, leaves no file, and on 2026-09-13 a verifying agent refused to tick
exactly those tasks because nothing in its evidence showed them.

The instruction says that such a task is confirmed by checking its effect
— running the command, checking the condition — and that leaving no
changed file is not by itself a reason to leave a task unticked.

The implementing run's own account of what it ran is not handed over as
evidence. It is a claim by the run being checked; the verifying agent
checks the effect instead.

## Decision: an implementing run that ticked nothing is reported, not refused

The chain already counts a change's tasks. It counts them before the
implementing stage and again after it, and already knows from its apply
checkpoint whether the run changed files.

When the run changed files and no task went from unticked to ticked, the
chain emits a `progress` event saying so as the stage ends. That reaches
the terminal, both panels and the run's status record, which is where a
person watching looks.

It does not fail the stage. The work may be fine and the ticks merely
missing, which verification can now repair; refusing would stop exactly
the chain this change is meant to let finish.

## Decision: the archive refusal names the tasks

The return from verification already names unticked tasks through
`unfinishedTaskTexts`, because a reader about to take the work over
otherwise has to open the file. The archive refusal is the same moment
for the same reader and today gives only a count. It uses the same
function.

## Non-Goals

Reverting a tick that came with nothing written, for ordinary tasks. That
rule exists for delegated items, whose whole point is the evidence.

Changing any project's rules, including this repository's.

Letting verification tick a human-only or delegated task.

## Risks / Trade-offs

A verifying agent may still tick generously. What it ticks is visible in
`tasks.md` and in the chain's diff, and the archive step still refuses
anything left unticked.

Instruction wording is the whole mechanism for two of these decisions,
and wording drifts. Tests pin the phrases that carry each rule.
