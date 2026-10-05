## Why

[ADR 0039](../../../docs/adr/0039-the-supervisor-advises.md). Every run
already says what it is doing and since when (ADR 0028), and every run's
end is in the audit log, but nothing draws a conclusion from either. In
the weeks before this change:

- a run waiting for a permission nobody saw read as a hung one;
- `copilot-cli-acp` failed with "Authentication required", and
  `claude-cli` with "claude exited with code 1" because it was not signed
  in. A CLI blocked by security software failed the same way. Nothing
  said that trying again would fail again, or what to do instead;
- a run that had said nothing new for many minutes looked exactly like
  one that was working.

The owner asked for a supervisor. The discussion kept the part that costs
nothing and helps every run: rules over records that already exist, which
suggest and change nothing. Choosing another agent where one fails is the
second change, `the-supervisor-changes-agents`.

## What Changes

- **A failed run says what is known about why.** Where a run fails, its
  reason and the last of its output are matched against known causes:
  the agent is not installed, not signed in, blocked by the machine
  (security software, permissions), the network cannot be reached, the
  service rate-limited it, or the service failed. The diagnosis says
  whether repeating can help, quotes the text it was found in, and says
  what to do instead. An unrecognised failure is diagnosed as unknown.
  The diagnosis rides the `failed` event as an optional field and is
  recorded on the run's audit entry.
- **The supervisor points out three things, as suggestions:**
  - a run whose heartbeat is alive and whose activity has not changed for
    longer than `supervisor.silentAfterSeconds` (600 by default), with
    what it last said and the commands to look at it and to ask it to
    stop. It never stops it;
  - a run waiting on a person (a checkpoint, a permission) for longer
    than `supervisor.waitingAfterSeconds` (60 by default), so a waiting
    run is not taken for a hung one;
  - a change whose last run failed for a cause a repeat cannot fix, with
    the remedy.
- **`supervisor.mode`**: `advise` by default, `off` to compute none of the
  above. Settable in both harness files and from both Harness Settings
  views. (`act` arrives with `the-supervisor-changes-agents`.)
- **Shown wherever runs are shown**: the suggestions in the Pipeline in
  both hosts, by the existing suggestion component, and from
  `openspec-ui-cli advise`; the diagnosis on a change's card, in a run's
  panel, in the run log and in `openspec-ui-cli run`'s output.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core`: a failed run carries a diagnosis.
- `agentic-harness`: the supervisor's mode, thresholds and suggestions.
- `shared-ui`: a card and a run's panel show the diagnosis; the Harness
  Settings views set the supervisor's mode.
- `ci-cli`: `advise` prints the supervisor's suggestions; `run` prints a
  failure's diagnosis.

## Impact

- `packages/core`: a failure-diagnosis module (browser-safe); the agent
  runner attaches it to a failed event and its audit entry; a supervisor
  module deriving suggestions from status records and last runs;
  `Hint` gains run kinds; `HarnessConfig.supervisor`; last runs and card
  text carry the diagnosis; `readPipelineReadiness` adds the
  supervisor's suggestions.
- `packages/webui`: the run panels show a diagnosis; both Harness
  Settings views gain the supervisor's mode.
- `packages/cli`: `advise` and `run`.
- `packages/extension`: regenerated harness schemas.
- `HARNESS.md`; ADR 0039.
- The protocol gains one optional field on `failed`. No command or event
  kind is added, and a reader that ignores the field reads on as before.
