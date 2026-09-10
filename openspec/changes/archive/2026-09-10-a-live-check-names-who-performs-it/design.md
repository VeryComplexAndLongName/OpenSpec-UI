# Design

## Decision: a second marker, not a replaced one

`**Human-only**` stays and keeps its meaning: no agent can do this. A
new marker, `**Delegated to <agent-id>**`, means a named agent can. Both
are bold leads on a task line, read by the same parser, and both leave
the task outstanding until it is done.

Replacing the human-only marker outright was rejected. There are real
checks no agent can make — whether a chart reads as a finding, whether
a sentence is confusing — and this repository has removed enough
settings that nothing reads to be careful about removing a category that
something does.

## Decision: the agent is named by its registry id

`copilot-cli`, not "Copilot". The ids are the ones the harness already
accepts in `stepAgents`, so the name in a task and the name in a
configuration are the same string, and a typo is detectable. The
collector checks the name against the registry and reports an unknown
one as unknown rather than as delegated: an item delegated to nobody is
the silent-loss case this convention exists to prevent.

## Decision: the evidence rule travels with the delegation

A delegated item states what the agent must record: a test name and its
run, a run id and an audit line, a command and its output. It is ticked
only with that recorded beside it, in the task text, the way the
repository's existing closing notes are written.

This is the whole safeguard. An agent asked to "confirm it works" will
confirm it works. An agent asked to quote the audit line carrying
`--agent` either has the line or does not.

## Decision: the inbox reports both, and says which

`collectHumanOnlyInbox` gathers unticked items that are human-only or
delegated, each carrying who it waits on. `describeHumanOnlyInbox` says
how many wait on a person and how many on each agent. A reader asking
"what is not moving" gets one answer, not one per category.

The name `collectHumanOnlyInbox` is kept. Renaming it would touch both
hosts and the REST route for no behavioural gain, and the change is
already editing six task files.

## Decision: copilot-cli, not copilot-cli-acp

Both were offered. `copilot-cli` is chosen: it was smoke-tested on this
machine today and answered a non-interactive prompt in six seconds
(`copilot -p ... --allow-all-tools`, 7.08 AI credits). The ACP adapter
works here too, but it has never emitted `session/request_permission` on
this machine, so its permission path is the one part of it this
repository has not seen work — and a delegated verification runs
unattended, which is exactly where a silent permission stall would cost
the most. Where a delegated item needs the ACP transport specifically,
it names `copilot-cli-acp`; none of the six does.

## Non-Goals

Changing what the harness does. No stage agent changes, no automatic
dispatch, no new command. The marker is read by the task parser and the
inbox, and by people writing tasks.

Ticking any of the six here. Five verify unbuilt work; the sixth waits
on a run due tonight.

## Risks / Trade-offs

The obvious risk is that delegation becomes a way to move work off a
person and onto an agent that then rubber-stamps it. The evidence rule
is the mitigation, and it is only as good as the specificity of what
each item asks for — which is why all six were rewritten here as
procedures with named artifacts, rather than left as "confirm it works"
with an agent's name attached.

A second risk: an item delegated to an agent that cannot in fact do it
sits forever, waiting on nobody, and looks assigned. The inbox naming
the agent is what makes that visible; a person reading "waiting on
copilot-cli" for three weeks can ask why.
