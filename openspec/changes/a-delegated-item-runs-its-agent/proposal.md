# A delegated item runs its agent

## Why

Asked for on 2026-09-10, in the owner's own words (translated, because
every file in this repository is English): "You write a task and mark it
Human-only. I hand it to Copilot and it does it perfectly well. But I
always do that by hand. Why?"

`a-live-check-names-who-performs-it` shipped the marking and the
reading. A task may say `**Delegated to copilot-cli**`, the parser
carries it as `delegatedTo`, the collector checks the name against the
registry, and both hosts list what is waiting and on whom. That change
put automatic dispatch in its own "Out of scope" section: the name says
who does it, and a person still starts the run.

A person still started every run. Seven delegated items were closed on
2026-09-11 and every one of them was driven by hand — two by the owner
handing the work to Copilot, five by me. The marking is read by a
surface and by nothing that acts. A name nothing dispatches is a label,
and this repository's own standard is that a setting nothing reads is
worse than no setting.

## Capabilities

### New

- An open delegated item can be run by the agent it names, from either
  host, through the same allowlist, working-directory sandbox and audit
  log every other agent run goes through.
- A change may say which agent a particular task uses, in its own
  `harness.json`, overriding what the task text says.
- An item that comes back ticked without the evidence it asked for is
  refused and left open.

### Modified

- The inbox that lists what is waiting offers to run what it lists,
  where the item names an agent that this build recognises.

## Out of scope

Running every delegated item of a change at once, or on a schedule.
One item, asked for deliberately. Fanning out across items is the same
question as running changes in parallel, which has its own change and
its own argument about worktrees.

Judging whether the evidence an agent wrote is true. Nothing can do
that mechanically. What is checked is narrower and still worth having:
that an item did not become ticked while saying nothing new.
