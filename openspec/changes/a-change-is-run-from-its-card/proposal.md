# A change is run from its card

## Why

ADR 0029 decides that the card carries the controls, and that each control
reaches the run itself: Start opens the run dialog, a waiting run is
answered on its card, and Stop is ADR 0028's request. Today none of that is
possible, and what exists behaves differently from one host to the other.

- **Starting a run happens away from the picture.** In the standalone
  shell, "Run with Agentic Harness" is a button in the Change Editor tab.
  In the editor it is a context-menu command on a tree item. The Pipeline,
  where a person sees what can start, offers only to open the change.
- **A run can be answered only from the panel that started it.** The run id
  lives only in `HarnessChainPanel`'s `runIdRef`, and a checkpoint is
  answered only there. The editor's Processes tree has "Cancel Process",
  but it aborts the scheduler's signal, which a chain never reads, so the
  chain keeps running.
- **The two hosts give different feedback.** The standalone server sends
  nothing back when a chain is cancelled; the extension sends
  `cancelling`.
- **Stopping is killing.** A cancel aborts the agent's process in the middle
  of a stage. ADR 0028 decides that a stop is a request, answered at a
  point where the work is sound.

## Capabilities

### New

- A core registry of the runs a host started. For each run it keeps the run
  id, the change, what the run is waiting for, and whether a stop has been
  asked.
- **Start** on a card opens the run dialog for that change, in both hosts.
- **Answer** on a card, for a run this host started:
  - at a checkpoint: Continue, or Stop;
  - at a permission request: Allow, or Deny.

  Such a card says "Waiting for you".
- **Stop** on a card asks for a reason and sends a request. The run stops at
  the next sound point:
  - at once, if it is waiting;
  - otherwise when its agent starts another task, when its next task is
    ticked, or when its stage ends, whichever comes first.

  The run's status says it was asked to stop, by whom, and why. The
  protocol gains a `stop` command and a `stopRequested` event.
- **Stop now** appears once a stop has been asked, for a run this host
  started. It is the existing cancel.
- For a run another host started, the card shows the folder the run was
  started in, with a control that copies its path, and offers nothing that
  opens it.

### Modified

- The standalone server answers a chain cancel with `cancelling`, as the
  extension already does.
- The editor's "Cancel Process" cancels a chain. The chain's scheduler entry
  takes the chain's own run id, so the cancel reaches the chain.
- A chain's recorded ending names a requested stop, with its reason and
  who asked.

## Impact

- `packages/core`:
  - the protocol (`stop`, `stopRequested`);
  - new `live-runs.ts`;
  - `harness-chain-runner.ts` and `agent-runner.ts` (stopping at a sound
    point);
  - `agent-status.ts` (a requested stop in the record);
  - `security.ts` (the ending's `stopRequest`).
- `packages/server`: `websocket.ts` (tracking runs, `stop`, `cancelling`
  for a chain) and a `POST /api/live-runs` route.
- `packages/extension`: tracking runs, `pipeline/live-runs` and
  `openspec-ui/run-change` on the pipeline panel, and `trackHarnessProcess`
  taking the chain's run id.
- `packages/webui`: the card's controls, the reason form, and the run dialog
  opened over the Pipeline tab.

## Out of scope

- Stopping a run that another process started. That needs signatures, and
  belongs to `a-run-elsewhere-can-be-asked-to-stop`.
- Answering a checkpoint elsewhere, which ADR 0029 rejects.
- Pausing, which ADR 0028 rejects.
