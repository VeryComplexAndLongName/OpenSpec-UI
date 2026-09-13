# Design

See `docs/adr/0029-the-pipeline-is-where-a-change-is-run.md`, "The task
in hand is what the agent says, or a guess labelled as one". This change
covers what a run says. The guess, and the card that shows it, come
later.

## Context

**The record.** `AgentStatusDocument` holds `version`, `instanceId`,
`activity`, `stage`, `changeName`, `workingDirectory`, `activityAt` and
`heartbeatAt`. `readAgentStatusRecord` copies fields one by one, requires
five of them, and never checks `version`.

**How a run's events reach the record.** Every host wraps its run loop in
`withAgentStatus`, which starts the record from the command's `kind`,
`cwd` and `context` only. `applyEventToAgentStatus` then maps events onto
the record:

- A `stdout` chunk, and streamed ACP text, go through `takeCompleteLine`,
  which returns the last completed non-empty line.
- The agent's message text and its thought text share one open-line
  buffer.
- `stageStarted`, `stageCompleted` and `progress` report an activity.
- Terminal events remove the record.
- Every other event, `checkpoint` and `permissionRequest` included,
  changes nothing.

**The instruction.** The implementing instruction,
`commandInstruction("implement")`, already tells the agent to tick each
task as soon as it has finished it. A delegated item's prompt runs as an
`implement` command that carries `taskNumber`, so it receives the same
instruction.

**Agents deliver text differently.** An ACP adapter streams updates as
they happen, and claude-cli-acp sends each assistant message whole. A
raw-text adapter passes stdout through whenever its CLI flushes it, and
this repository has no record of when each CLI flushes.

## Decisions

### The marker is a plain sentence at the start of a line

A marker is a line that, after surrounding markdown emphasis and leading
quote, heading or list marks are removed, begins with the words
`Starting task` and a space, followed by a task number, and then ends or
continues after a colon.

- **Rejected: an invented token such as `[task 2.3]`.** Models reproduce
  a plain sentence more reliably than made-up syntax, and brackets already
  mean checkboxes in `tasks.md`.
- **Rejected: recognising free prose such as "working on 2.3".** It
  cannot be matched without guessing, and a guess is what this change
  exists to avoid.

### Every completed line is read, not only the last

When a chunk completes several lines, each one is checked for a marker.
The activity is still the last of them.

- **Rejected: checking only the line that becomes the activity.** It
  loses the marker whenever a message arrives whole, which is the normal
  case for claude-cli-acp.

### Only the reply can name a task

A marker is read from an agent's reply (`agent_message_chunk`) and from
raw stdout. It is never read from reasoning (`agent_thought_chunk`), or
from the line `describeAcpUpdate` gives a tool call.

To make that possible, reply text and reasoning text get separate
open-line buffers. A thought chunk can then never complete a line that a
reply started.

- **Rejected: reading reasoning too.** Reasoning says "I'll start task 2.3
  after this" long before the agent starts it. ADR 0029 names the reply.

### The task is a field of its own, written at once

The record gains `task: { number, source, since }`. A marker sets it with
source `agent` and writes the record immediately, outside the
once-a-second limit that applies to streamed activity. When several
markers arrive, the latest one wins.

- **Rejected: carrying the task in the activity.** The next line of
  output replaces the activity within a second.
- **Rejected: sending the task through the throttled path.** The
  throttle keeps only the newest text. A marker is rare, and would be lost
  to the line that follows it.

### A run given one task keeps that task

A run started with `command.taskNumber` records that number, with source
`command`, when its record starts. A marker never replaces it.

- **Rejected: letting the latest marker win for such a run too.** A
  delegated run that names another task has left the item it was given.
  The record should keep saying what the run was asked to do, which is
  also what its audit entry says.

### Waiting is a field, not a phrase

- A `checkpoint` event sets `waiting` to `{ kind: "checkpoint", stage,
  nextStage }` and the activity to `waiting to continue to <nextStage>`.
- A `permissionRequest` event sets `waiting` to
  `{ kind: "permission", description }`.
- The next event of any other kind clears `waiting`.

Every change to `waiting` is written at once.

- **Rejected: saying it only in the activity text.** Every reader would
  then have to parse words to learn that a run is waiting.

### The run id comes from the command

`withAgentStatus` records `command.runId`. The record's `instanceId` stays
the identifier the run generated for itself.

- **Rejected: using the run id as the instance id.** ADR 0028 has every
  instance generate an identifier that it shares with nobody. A run id is
  chosen by a host and travels in commands.

### The task list is consulted when a record is read, not when it is written

`taskInHand` pairs a record's task number with the change's task list,
using `taskNumberOf`, and returns nothing when the list has no such
number. The survey and `openspec-ui-cli status` call it; they already read
the list.

- **Rejected: validating in the writer.** It would read `tasks.md` inside
  the run's event loop on every marker. A reader reads the list anyway.

## Protocol

No command kind and no event kind is added or changed. `Command.runId`,
`Command.taskNumber`, `checkpoint` and `permissionRequest` all exist
already, so the server and the extension carry nothing new.

The status record is not part of the command and event protocol. Its new
fields are optional to readers:

- A reader from before this change ignores them, because it copies
  fields by name.
- A record from before this change is read with the new fields `null`.

## Non-Goals

- A guess at the task in hand when no marker came.
- Anything a Pipeline card says beyond a directory's run lines.
- Answering a checkpoint or a permission from a surface other than the
  one that started the run.
- A new event kind for the task in hand, which ADR 0029 rejects.
- Checking whether the agent actually works on the task it names. The
  marker is the agent's claim, like the activity (ADR 0028), and the
  surfaces say "by its own account".

## Risks / Trade-offs

- **An agent may ignore the instruction.** The record then names no task.
  The guess that `a-card-says-what-its-change-is-doing` adds covers this,
  and it is labelled as a guess.
- **Some agents may deliver their reply only when they finish.** Their
  markers would then arrive too late to matter. Task 6.5 establishes, by
  running them, which agents deliver markers while they work. The design
  does not depend on the answer.
- **A reply can quote repository text that happens to look like a
  marker.** The number is still checked against the change's list, so at
  worst the record names a real task of the change, by the agent's
  account.
- **The record is written slightly more often:** once per marker and once
  per change of waiting state. A marker arrives about once per task,
  which is a small amount next to the five-second heartbeat.
