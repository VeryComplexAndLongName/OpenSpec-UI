The observed failure is a hang, and a hang has no error to read. Every
task below is written so that the fixed code fails loudly instead —
including the case where no answer is possible, which today waits
forever.

## 1. Route the answer to the run that asked

- [ ] 1.1 `HarnessChainRunner.asAgentRunner()` handles
  `"resolvePermission"` beside `"cancel"`, rather than letting it reach
  `run()`. Today it becomes `HarnessChainRunner.run only accepts "chain"
  commands` — a failed event on the chain's stream, while the stage's
  agent keeps waiting.
- [ ] 1.2 The chain holds the runner executing the stage in flight.
  `ChainState` already carries `cancelRequested`; cancellation needs a
  flag, an answer needs the runner itself, so this is a new field rather
  than a reuse.
- [ ] 1.3 Forward by calling that runner with the command unchanged, so
  the driver's `runId:requestId` key matches what it stored. Do not
  rewrite the run id on the way through: the mismatch is half of the
  original defect.
- [ ] 1.4 Clear the held runner when the stage ends, on every path —
  completed, failed, cancelled. A stale runner would send a later answer
  to a process that has exited.
- [ ] 1.5 An answer naming no pending request is a no-op, not an error.
  `AcpSessionDriver.resolvePermission` already returns `false` for this;
  the chain must not turn that into a failed event.

## 2. Carry the request out with the stage's own id

- [ ] 2.1 `permissionRequest` events reach the chain's stream with the
  id the stage's run published, unmodified. A surface answering from the
  event then names what the driver is waiting for.
- [ ] 2.2 Confirm against the driver, not by reading: the key is
  `${runId}:${requestId}` built where the request is raised, so a test
  must assert the pair that arrives equals the pair that resolves.

## 3. Somewhere to answer

- [ ] 3.1 `HarnessChainPanel` renders a pending permission request and an
  Allow/Deny control. It has none today — no `permissionRequest`, no
  `resolvePermission` — so the controls the operator used belonged to
  `AiPanel`, built for a single-stage run.
- [ ] 3.2 Answer with the id from the event, never the id of the run the
  panel is watching. `AiPanel` uses `runIdRef.current`, which is the
  chain's; that is why the answer would not have matched even if it had
  arrived.
- [ ] 3.3 Once answered, the control stops offering the same request
  again, matching `AiPanel`'s `resolvedPermissionRequestIds`.
- [ ] 3.4 Do not add the control to `AiPanel` for chain runs, and do not
  make `AiPanel` answer chain requests. One surface owns one run shape;
  the crossover is what produced the mismatched id.

## 4. Fail instead of waiting

- [ ] 4.1 Under `autonomous` there is no confirmation channel — the
  repository's own task rules say so — so a permission request there can
  never be answered. The stage fails, naming the request and the reason.
- [ ] 4.2 The failure text says what was asked for, not just that
  something was. "A permission request cannot be answered under
  autonomyLevel autonomous" with the tool call described.
- [ ] 4.3 Do not answer on the operator's behalf. Defaulting to allow
  would remove the gate the request exists to be, and would do it
  silently on the level that runs unattended.

## 5. Tests

- [ ] 5.1 A `"resolvePermission"` command through `asAgentRunner()`
  reaches the stage's runner with its command unchanged — asserted
  against the runner, not by absence of an error.
- [ ] 5.2 The same command when no stage is in flight yields no failed
  event.
- [ ] 5.3 A `permissionRequest` raised by a stage appears on the chain's
  stream with the stage's run id.
- [ ] 5.4 Under `autonomous`, a stage whose agent raises a permission
  request fails, and the message names the request.
- [ ] 5.5 The panel answers with the event's id: a test that would pass
  if it used the watched run id must fail.

## 6. Verification

- [ ] 6.1 `openspec change validate --strict chain-answers-a-permission-request`.
- [ ] 6.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 6.3 Version bump via `npx changeset`: `core` and both hosts.
- [ ] 6.4 Document in the extension README that a chain can now be
  answered, beside the existing harness entry.
- [ ] 6.5 **Human-only**: run a chain on an agent that asks for
  permission — `copilot-cli-acp` is the one that does — at
  `semi-autonomous`, answer Allow, and confirm the stage continues rather
  than stalling. Then run the same at `autonomous` and confirm it fails
  with the stated reason instead of hanging. The second half is the one
  that was found the hard way.
