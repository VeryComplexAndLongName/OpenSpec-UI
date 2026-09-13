# Design

This change implements the second half of ADR 0028: "A stop is a
recommendation", "Freshness is part of the envelope", "The bytes are what is
signed", and "The console does not offer what a person should not do by
accident; the protocol forbids nothing". It also covers ADR 0029, "A run
elsewhere is reached only through ADR-0028's signed channel", and the
2026-09-13 amendment to ADR 0026.

## Context

- After `a-change-is-run-from-its-card`:
  - a run stops at a sound point through `requestStop(runId, reason, by)`;
  - a record carries `runId` and `stopRequested`;
  - a card offers Stop for its host's own runs.
- After `a-run-is-signed-by-its-person`:
  - a person has a machine key and a roster entry;
  - records are sealed envelopes, read as verified, unverified, or not
    checking out;
  - a verified report carries its `person`.
- The status writer renews its record every 5 seconds.
- Every host wraps its run in `withAgentStatus`.

## Decisions

### A request is a file of its own, in a sibling directory of the channel

A request is written to `<worktreeRoot>/<repo>/.agent-messages/<messageId>.json`.
The file is sealed with `sealEnvelope`, and its payload is:

`{ version: 1, messageId, kind: "stop", to: instanceId, reason, sentAt, machine, gitAuthor? }`

The person asking writes it through a temporary name and a rename.

Rejected:

- **Writing into the run's status record.** ADR 0028 allows one writer per
  fact, and the record belongs to the run.
- **Writing into the run's working directory.** The ADR 0026 amendment
  forbids it: asking does not touch the directory.

### The run reads its requests at renewal

At each renewal, the writer lists the directory and opens every file. It
keeps a file only when its payload's `to` is its own instance. A payload is
parsed only after its envelope opens.

The writer then acts on a request only when all three hold:

- it is verified;
- `sentAt` is within `STOP_MESSAGE_STALE_AFTER_MS` (60 000);
- its `messageId` is not in the run's seen set.

When it acts, it calls the host's `onStopRequested` with the reason and
`by`, the enrolled person's label.

Rejected:

- **A watcher on the directory.** A run already wakes every 5 seconds, and a
  watcher would add a second, platform-dependent way to learn the same
  thing.

### A request that is not acted on is still said

A request addressed to the run can go unacted on for three reasons: it is
unverified, it is stale, or it was already seen. For each such request, the
run's activity says so, once per message, for example "a request to stop
arrived, not verified; not acted on". The audit log records the message id
and why.

A request whose envelope does not check out is never parsed, so nothing
says which run it was meant for, and no run reports it as its own.
`openspec-ui-cli status` reports it by file name instead. A request to a
run that has already ended is read by nobody, and the sweep removes it.

Rejected:

- **Dropping such requests silently.** ADR 0028 counts an unverified message
  as belonging to nobody, but a person watching must still see that one
  arrived.

### Freshness has two parts: a window and a seen set

The instance identifier is unique to the run, so a request cannot be
replayed to a later run. Within the same run, the seen set refuses a
request that comes again. The 60-second window refuses one that was kept
for later.

Rejected:

- **Persisting the seen set.** It dies with the run. So does the only
  instance a replay could reach.

### The host decides how its run stops

`withAgentStatus` gains `onStopRequested(request)`. Every host passes a
callback that calls `requestStop` on the run it holds:

- the server's WebSocket runs, and its delegated item route;
- the CLI's `run-change.ts`;
- the extension's `RunController` and its chain start.

The stop is then exactly the one a card asks of a run on its own host.

Rejected:

- **Core finding the runner by itself.** A run's runner is held by its host,
  and core keeps no global registry of hosts.

### Stop is offered on a card only for the person's own verified runs

A card for a run that is not in its host's live runs offers Stop only when
both hold:

- the run's record is verified;
- the record's `person` label equals the roster label of this host's own
  machine key.

Otherwise, the card states whose run it is, or that the run is not verified,
and offers nothing.

The host checks the named instance against the live records it has just
read, and refuses any other. It then asks with its own key, through
`POST /api/runs/ask-to-stop` or `pipeline/ask-to-stop`.

Rejected:

- **Offering Stop on every card.** ADR 0028 says stopping somebody else's
  agent is not offered in the interface. The command line still allows it,
  and names the person who asked.

### The card says when a request has not been read yet

Until the run's record shows `stopRequested`, the card says
`stop requested <age> ago; waiting for the run to read it`. After two
renewal windows it says the run has not read the request. It never says the
run refused.

## Protocol

No command or event changes. Within a run, the stop reaches the runner
through the existing `requestStop`, and the resulting `stopRequested` event
is the one `a-change-is-run-from-its-card` added. The new files are
coordination files, not protocol messages.

## Non-Goals

- A request to continue, to answer, or to report.
- Terminating another process.
- Persisting seen message ids.
- The analysis report on request frequency and origin.

## Risks / Trade-offs

- **A run that stopped renewing never reads its request.** It is past the
  staleness window, so the card already shows it as gone.
- **Two people who share a roster label read as one person.** The label is
  chosen at enrolment, and a person who shares one with somebody else can
  stop that person's runs from a card. The roster names the machine, so the
  shared label can be seen and changed.
- **Clock skew between machines can make a fresh request stale.** On one
  machine this cannot happen. The 60-second window leaves room for small
  skew, and the run's activity says when it refused a request as stale.
- **Every renewal opens every message file.** The files are small and swept
  after their window, so the directory holds only recent requests.
