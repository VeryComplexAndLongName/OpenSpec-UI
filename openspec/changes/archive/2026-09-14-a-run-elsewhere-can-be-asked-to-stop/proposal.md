# A run elsewhere can be asked to stop

## Why

ADR 0028 decides that a stop is a request, addressed to a run by its
identifier and carried through a directory beside the working directories.
It is implemented in two changes, and this is the second: "the signed
channel for asking one to stop". ADR 0029 decides where a person asks: on
the card of a run that another process started, only once a signature shows
the run belongs to the person asking. The ADR 0026 amendment of 2026-09-13
states that asking does not touch the run's directory.

Without this change, a run that another process started cannot be stopped
from anywhere:

- **Every cancel is a lookup in the host's own memory.** That holds for
  `HarnessChainRunner.active`, `AgentRunner`'s runs, and the extension's
  `RunController`. A run in another working directory is in none of them.
- **A person's only remedy is to kill a process by hand.** ADR 0028 names
  exactly this problem.

The pieces this change needs arrive first:

- `a-change-is-run-from-its-card` gives a run a way to stop at a sound
  point, and a card a Stop control.
- `a-run-is-signed-by-its-person` gives a person a key, a roster and
  records that say whose they are.

## Capabilities

### New

- **A signed request to stop.** A file of its own in the channel, sealed in
  the same envelope as the status record, and addressed to one run's
  instance identifier. It carries a reason, when it was sent, and its own
  identifier.
- **The run reads its requests** each time it renews its record. It acts on
  a request only when all of these hold:
  - the request is verified;
  - it is fresh;
  - it has not been seen before.

  A request it acts on stops the run at its next sound point, and the run's
  status names the enrolled person who asked. A request it does not act on
  is reported in its status and in the audit log.
- **`openspec-ui-cli stop <instanceId> --reason <text>`** sends the request
  from a terminal.
- **Stop on the card of a run another host started,** offered only when the
  run's record is verified as the asking person's own.

### Modified

- The sweep removes request files that are past their freshness window.
- A run's recorded ending names the request it acted on.

## Impact

- `packages/core`:
  - new `agent-messages.ts`;
  - `agent-status.ts`, where the writer reads requests at renewal;
  - `withAgentStatus` gains a hook to the host's stop;
  - the sweep.
- `packages/cli`: new `stop-command.ts`, and the hook in `run-change.ts`.
- `packages/server`: the hook in `websocket.ts` and in the delegated item
  route, and a route that asks a run to stop.
- `packages/extension`: the hook in `run-controller.ts`, and
  `pipeline/ask-to-stop`.
- `packages/webui`: Stop on a card for a run elsewhere, and the words for a
  request not yet read.

## Out of scope

- Answering a run elsewhere, which ADR 0029 rejects.
- Terminating a process that another process started. The operating system
  enforces that (ADR 0028).
- Dormant keys, and the analysis report.
