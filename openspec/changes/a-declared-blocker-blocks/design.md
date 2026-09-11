# Design

## Decision: this is the run gate, not the validation gate

`findUnmetBlockers`' own comment says an unmet blocker is "not a
violation: it states a plan, and a plan not yet carried out is not a
defect. Surfaces report it; the gate does not fail on it." Somebody will
read that and think this change contradicts it. It does not, and the
distinction is worth stating once.

`checkChangeGraph` answers **does this repository validate** — the merge
gate CI runs. A change declaring a blocker is valid; refusing to merge
it would refuse to merge a plan.

`resolveChainStart` answers a different question: **may this run start
now**. A change that says of itself "do not start me until that lands"
answers that one itself.

Nothing about validation changes.

## Decision: an unmet blocker is one that is still an active change

Exactly `findUnmetBlockers`' existing rule, reused rather than restated.
A blocker that has been archived is satisfied — that is what `blocked_by`
has always meant. A blocker naming a change that does not exist at all
does **not** block: that is a graph violation, and
`checkChangeGraph` already reports it as one. Two different faults, two
different reports, and folding them together here would hide the second
behind the first.

## Decision: no flag starts a blocked change anyway

Every other refusal in `resolveChainStart` names the configuration key
that governs it, so a reader can go and change it. This one names the
blocker instead, because the remedy is not a setting: land that change,
or delete the line from this one's `.openspec.yaml`.

A `--force` here would move a decision the author wrote in a
version-controlled file into a shell history nobody reviews. ADR 0020
decision 3 rejected exactly that shape for every other gate in the
terminal, and this is not the place to make an exception.

## Decision: where it sits in the resolution order

After the checkpoint check and before the declared steps and the stage
agents.

The file's stated principle is cheapest and most likely first. This one
is not the cheapest — it reads every change's `.openspec.yaml` to build
the graph, where the agent check is a map lookup — so the principle is
bent, deliberately, for the other half of it: a run refused for a
blocker should say so rather than say "the apply stage names an agent
this build does not have". The blocker is the reason the run should not
happen; the agent is a detail of a run that was never going to start.

## Non-Goals

Anything about collisions, validation, or an override. Anything in the
interactive hosts: they open a picker or a chain through the same
`resolveChainStart`, so they inherit this without a change of their own.

## Risks / Trade-offs

Building the change graph costs a directory walk on every chain start.
It is the same walk `ready` already does, on a directory whose size is
the number of active changes — which this repository keeps near zero by
archiving. Measured against the alternative — starting a chain that the
change itself said not to start — it is not a close call.

A person who wants to run a blocked change now has to edit a file. That
is the intent: the file is where they said not to.
