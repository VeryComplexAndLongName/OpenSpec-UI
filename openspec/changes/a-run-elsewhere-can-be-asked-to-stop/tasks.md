A signed request to stop, read by the run it names at renewal and acted on
only when verified, fresh and new (ADR 0028, ADR 0029, ADR 0026 amendment).

## 1. The request

- [ ] 1.1 `packages/core/src/agent-messages.ts` exports:
  - `agentMessageDirectory(root, mainPath)`, returning
    `<root>/<repo>/.agent-messages`, beside `agentStatusDirectory`;
  - `StopMessage { version: 1; messageId: string; kind: "stop"; to: string; reason: string; sentAt: string; machine: string; gitAuthor?: string }`;
  - `STOP_MESSAGE_STALE_AFTER_MS = 60_000`.
- [ ] 1.2 `askRunToStop({ directory, to, reason, key, machine, gitAuthor })`
  seals the message with `sealEnvelope` and writes it to
  `<messageId>.json` through a temporary name and rename. It returns the
  `messageId`, a random UUID.
- [ ] 1.3 `readStopRequests({ directory, instanceId, roster, now, seen })`
  opens every file with `openEnvelope`, parses a payload only once its
  envelope opens, and keeps the payloads whose `to` is `instanceId`. It
  returns each kept message with one of these states:
  - `act`: verified, within `STOP_MESSAGE_STALE_AFTER_MS` of `sentAt`, and
    not in `seen`;
  - `refused`, with `why`: `unverified`, `stale` or `seen`.

  A file whose envelope does not check out is never parsed, so nothing says
  which run it is addressed to. `readStopRequests` returns nothing for it.
  Do not attribute it to whichever run happens to read it.
- [ ] 1.4 `readUnopenedRequests(directory, roster)` returns the file names of
  requests whose envelope does not check out. `openspec-ui-cli status`
  reports each one beneath the runs as
  `a request to stop that does not check out: <file>`.
- [ ] 1.5 core `agent-messages.test.ts`:
  - a verified message for this instance is acted on;
  - the same message a second time is refused as `seen`;
  - a message 61 seconds old is refused as `stale`;
  - a message from an unenrolled key is refused as `unverified`;
  - a message with one changed byte is not parsed, is not returned for any
    instance, and is listed by `readUnopenedRequests`;
  - a message for another instance is not returned.

## 2. The run reads its requests

- [ ] 2.1 `withAgentStatus` in `packages/core/src/agent-status.ts` gains a
  seam, `onStopRequested?: (request: { reason: string; by: string; messageId: string }) => void`.
  At each renewal, the writer calls `readStopRequests` for its instance and
  adds every returned `messageId` to its seen set. For each `act` message,
  it calls `onStopRequested` with the reason, the enrolled person's label,
  and the message id.
- [ ] 2.2 For each `refused` message, the writer sets the activity, once per
  message, to `a request to stop arrived, <why>; not acted on`. It also
  writes an audit entry with the run's `runId`, the message id and the
  reason for refusal.
- [ ] 2.3 Each host passes an `onStopRequested` that calls `requestStop` on
  the run it holds, with the request's reason and `by`. Record each junction
  as checked:
  - `packages/server/src/websocket.ts`;
  - the delegated item route in `packages/server/src/server.ts`;
  - `packages/cli/src/run-change.ts`;
  - `packages/extension/src/run-controller.ts`;
  - the chain start in `packages/extension/src/webview/ai-panel.ts`.
- [ ] 2.4 After a stop acted on from a request, the chain's ending entry
  carries `stopRequest { reason, by }` and the request's `messageId`.
- [ ] 2.5 `sweepAgentStatuses` also removes message files whose modification
  time is older than `STOP_MESSAGE_STALE_AFTER_MS` plus the staleness
  window. Before removing a file, it checks the file's age again, as it does
  for records.
- [ ] 2.6 core `agent-status.test.ts`:
  - a verified request calls `onStopRequested` exactly once across two
    renewals;
  - an unverified request never calls it, and sets the activity line once;
  - a writer that has been stopped reads no requests.

## 3. Asking

- [ ] 3.1 `openspec-ui-cli stop <instanceId> --reason <text>`, in
  `packages/cli/src/stop-command.ts`, reads the live records. It refuses an
  instance that has no live record, exiting non-zero and saying so.
  Otherwise it writes the request with this machine's key and prints the
  message id. Add a test.
- [ ] 3.2 `describeChangeCards` in `packages/core/src/change-card.ts` marks a
  live run that is not `ownedHere` as `stoppableByMe` only when both hold:
  - its record is verified;
  - its `person` label equals the roster label of this host's machine key,
    which the host passes as `myLabel`.

  Do not compare in the view.
- [ ] 3.3 A card whose run is `stoppableByMe` offers `Stop`, with the same
  reason form as for an owned run. Sending it calls:
  - `POST /api/runs/ask-to-stop` in the standalone server, handled by
    `handleAskToStopRequest` in `rest.ts`;
  - `pipeline/ask-to-stop` in the editor's pipeline panel.

  Both handlers check that the instance is one of the live records they have
  just read, and refuse any other. They then call `askRunToStop` with the
  host's key.
- [ ] 3.4 A card whose run is neither `ownedHere` nor `stoppableByMe` states
  whose the run is (`<label>'s run, verified`, or `not verified`) and offers
  no Stop.
- [ ] 3.5 Until the run's record shows `stopRequested`, the card says
  `stop requested <age> ago; waiting for the run to read it`. After two
  renewal windows it says `the run has not read the request`.
- [ ] 3.6 Tests:
  - webui `PipelineView.test.tsx`: Stop is offered only for a verified run
    whose person is `myLabel`, and the waiting words appear;
  - server: the route refuses an unknown instance;
  - extension: `pipeline/ask-to-stop` refuses an unknown instance.

## 4. Verification

- [ ] 4.1 This change validates strictly. `check(validate-change)`
- [ ] 4.2 Run `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and each package's test count.
- [ ] 4.3 A pending changeset exists: core, cli, server, extension and webui,
  each at minor. `check(changeset-present)`
- [ ] 4.4 Run the whole browser suite, not a selected spec.
- [ ] 4.5 **Delegated to claude-cli**: stop a run in another worktree through
  the channel.

  Setup:
  - a scratch git repository with worktrees A and B, and this machine's key
    enrolled;
  - in B, a chain with a stand-in agent that ticks a task after 20 seconds
    and then waits 60;
  - from A, the standalone server built from this branch.

  Steps:
  1. Write a request to B's run by hand, then change one byte of its
     payload.
  2. On B's run's card in A's Pipeline, press Stop with the reason
     `live check`.
  3. After B's run has ended, ask it to stop again with
     `openspec-ui-cli stop`.

  Evidence:
  - for the altered request: B's run went on, and `openspec-ui-cli status`
    reported a request that does not check out, by file name;
  - the message file for the card's request;
  - B's status record saying it was asked, by the enrolled label;
  - B's chain ending entry, with `stopRequest` and the message id;
  - the time from asking to `cancelled`, which falls after the tick;
  - the CLI command's output for the ended run: refused, with a non-zero
    exit;
  - a listing of B's working directory before and after the card's request,
    showing that A wrote nothing inside B (ADR 0026 amendment).
