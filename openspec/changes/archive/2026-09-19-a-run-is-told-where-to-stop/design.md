## Context

`agent-messages.ts` writes one kind of request today: `stop`, sealed with
the machine key, addressed to a run's instance identity, refused when
unverified, stale past 60 seconds, or seen before. `AgentStatusWriter`
reads them at every renewal, every 5 seconds, and hands a verified one to
`onStopRequested`, which calls `HarnessChainRunner.requestStop`.

`requestStop` sets `state.stopRequest`. From there `untilStopBoundary`
ends the stage at the first sound point: a task marker naming a task other
than the last one named, the count of ticked tasks rising, or the stage's
own end; a chain waiting at a checkpoint ends at once. The chain then ends
cancelled with the reason and the asker.

So the machinery for "stop soundly" is built. This change adds one field
to the request and one condition in front of the existing one.

## Goals / Non-Goals

**Goals:**

- An operator says "finish 4.6, then stop" without watching the run.
- It is the same signed channel, the same refusals, the same audit.
- A request that can no longer be honoured says so, rather than being
  held for ever or applied silently at the wrong moment.

**Non-Goals:**

- **Pause and resume.** ADR 0028 rejected them; the proposal says why that
  still holds.
- **Free text to the agent.** The next change. This one is a directive the
  runner carries out itself, with no agent cooperation and nothing
  appended to a prompt.
- **Editing the task list.** Naming a task to stop after reads the list;
  it never writes it.

## Decisions

### The task travels in the stop request, not in a second kind

`StopMessage` gains an optional `afterTask`. A request with it is still a
stop: the same envelope, the same verification, the same handler. A run
that reads one holds it instead of stopping at once.

**Rejected: a `directive` kind of its own.** It would double the reading
path and the refusal words for one field, and a reader of the channel
would have to learn that two kinds both mean stop. The field says
everything the second kind would have.

### "After 4.6" means "once 4.6 is ticked"

The condition is evaluated where the stop boundary already looks: the
ticked count and the task markers. When the named task's checkbox is
ticked, or a marker names a task that sorts after it, the held request
becomes the ordinary pending stop, and the existing boundary ends the
stage at the next sound point.

The run may already be inside 4.7 when that happens. That is the honest
reading of "stop after 4.6": the task is done, and the next sound point is
where the work stays sound. A promise to stop *exactly* between two tasks
would need the agent to cooperate, which is what the next change is about.

**Rejected: counting ticks.** "Stop when three more are ticked" would not
need the task list parsed, and it would mean something different to every
reader: a change whose tasks are not ticked in order would stop somewhere
nobody named.

### A request that cannot be honoured is refused, not held

Where the named task is already ticked when the request arrives, the run
stops at the next sound point and says so: the operator asked for a point
that has passed, and holding the request would mean a run that never
stops. Where the change's task list has no such task, the request is
refused with that reason, said in the activity and recorded, and the run
goes on - a typo must not silently become "stop now" nor "never stop".

### Freshness is about delivery, not about the stop

The channel refuses a request older than sixty seconds. That stays, and it
is about when the request was *read*: a request read within the window is
accepted, and the task it names may be reached an hour later. The window
protects against a request revived from an old file, which is unchanged
here.

### The audit says where it was told to stop

The chain's ending entry already carries the reason, the asker and the
message identifier. It gains the task. "Cancelled, asked to stop after
4.6 by DW" is the line a person reads a week later; without the task it
reads as a stop that happened to land there.

## Risks / Trade-offs

- **The task list is the contract, and it moves.** An agent may renumber
  or insert tasks while the run is under way, and then `4.6` names
  something else than it did when the operator typed it. The refusal for
  an absent task limits the damage; the rest is the same trust the task
  list already carries everywhere else.
- **The run may be far past the point by the time the message arrives.**
  Read every five seconds, so the window is small, but it exists. The run
  says what it was asked and when, so a stop that lands later than
  expected is explainable rather than mysterious.
- **Two requests, two tasks.** The first held request wins, as a second
  stop while one is pending changes nothing today. Stated so a later
  reader does not take the order for chance.
- **It is still a recommendation.** ADR 0028's rule holds: asking is not
  authority, and a run that has already ended ignores it.
