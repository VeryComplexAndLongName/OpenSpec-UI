The observed failure is a hang, and a hang has no error to read. Every
task below is written so that the fixed code fails loudly instead —
including the case where no answer is possible, which today waits
forever.

## 1. Route the answer to the run that asked

- [x] 1.1 `HarnessChainRunner.asAgentRunner()` handles
  `"resolvePermission"` beside `"cancel"`, rather than letting it reach
  `run()`. Today it becomes `HarnessChainRunner.run only accepts "chain"
  commands` — a failed event on the chain's stream, while the stage's
  agent keeps waiting.
- [x] 1.2 The chain holds the runner executing the stage in flight.
  `ChainState` already carries `cancelRequested`; cancellation needs a
  flag, an answer needs the runner itself, so this is a new field rather
  than a reuse.
- [x] 1.3 Forward by calling that runner with the command unchanged, so
  the driver's `runId:requestId` key matches what it stored. Do not
  rewrite the run id on the way through: the mismatch is half of the
  original defect.
- [x] 1.4 Clear the held runner when the stage ends, on every path —
  completed, failed, cancelled. A stale runner would send a later answer
  to a process that has exited.
- [x] 1.5 An answer naming no pending request is a no-op, not an error.
  `AcpSessionDriver.resolvePermission` already returns `false` for this;
  the chain must not turn that into a failed event.
- [x] 1.6 **Scope widened per design.md's "Scope gap to resolve before
  implementing"**: neither host routes a fresh `"resolvePermission"`
  message to the chain runner without this. `packages/server/src/
  websocket.ts`'s `handleSocketMessage` gains a branch beside its existing
  `"confirmCheckpoint"`/`"cancel"` handling: a `"resolvePermission"` command
  is passed to `chainRunner.resolvePermission(command)`; a `true` return
  ends handling there, a `false` return falls through to the existing
  `dispatchSingleStage` path unchanged.
- [x] 1.7 The same branch in `packages/extension/src/webview/
  ai-panel.ts`'s `handleWebviewMessage`, beside its existing
  `"confirmCheckpoint"`/`"cancel"` handling, calling
  `this.deps.chainRunner.resolvePermission(command)` with the same
  fall-through-on-`false` behaviour.
- [x] 1.8 `packages/extension/src/webview/ai-panel.ts`'s
  `trackHarnessProcess` excludes `"resolvePermission"` the same way it
  already excludes `"cancel"` (`ai-panel.ts:164`) — an answer is not work
  and produces no terminal event of its own, so without this exclusion
  every Allow/Deny click opens a Processes entry that can never terminate.

## 2. Carry the request out with the stage's own id

- [x] 2.1 `permissionRequest` events reach the chain's stream with the
  id the stage's run published, unmodified. A surface answering from the
  event then names what the driver is waiting for.
- [x] 2.2 Confirm against the driver, not by reading: the key is
  `${runId}:${requestId}` built where the request is raised, so a test
  must assert the pair that arrives equals the pair that resolves.

## 3. Somewhere to answer

- [x] 3.1 `HarnessChainPanel` renders a pending permission request and an
  Allow/Deny control. It has none today — no `permissionRequest`, no
  `resolvePermission` — so the controls the operator used belonged to
  `AiPanel`, built for a single-stage run.
- [x] 3.2 Answer with the id from the event, never the id of the run the
  panel is watching. `AiPanel` uses `runIdRef.current`, which is the
  chain's; that is why the answer would not have matched even if it had
  arrived.
- [x] 3.3 Once answered, the control stops offering the same request
  again, matching `AiPanel`'s `resolvedPermissionRequestIds`.
- [x] 3.4 Do not add the control to `AiPanel` for chain runs, and do not
  make `AiPanel` answer chain requests. One surface owns one run shape;
  the crossover is what produced the mismatched id.

## 4. Fail instead of waiting

- [x] 4.1 Under `autonomous` there is no confirmation channel — the
  repository's own task rules say so — so a permission request there can
  never be answered. The stage fails, naming the request and the reason.
- [x] 4.2 The failure text says what was asked for, not just that
  something was. "A permission request cannot be answered under
  autonomyLevel autonomous" with the tool call described.
- [x] 4.3 Do not answer on the operator's behalf. Defaulting to allow
  would remove the gate the request exists to be, and would do it
  silently on the level that runs unattended.

## 5. Tests

- [x] 5.1 A `"resolvePermission"` command through `asAgentRunner()`
  reaches the stage's runner with its command unchanged — asserted
  against the runner, not by absence of an error. The gap was real as
  written: the `asAgentRunner` describe block covered `"chain"` and
  `"cancel"` only, and the existing forwarding test called
  `chain.resolvePermission(command)` directly, leaving the adapter branch
  and its empty-generator return unexercised.
  Done 2026-09-07: "routes a resolvePermission command to the stage's own
  runner, unchanged, and yields nothing" in
  `harness-chain-runner.test.ts`, driving
  `chain.asAgentRunner().run({ kind: "resolvePermission", ... })` with a
  stage in flight. It asserts both halves — `calls.at(-1)` equals the
  answer object, and the adapter's own stream is empty.
  Shown to be able to fail, which a passing test does not show on its
  own: with the `resolvePermission` branch in `asAgentRunner` disabled,
  this test fails and no other does (1 failed, 45 passed), and it fails
  on exactly the event the branch exists to prevent —
  `HarnessChainRunner.run only accepts "chain" commands, got
  "resolvePermission"`. So nothing else in the suite covered this path.
- [x] 5.2 The same command when no stage is in flight yields no failed
  event.
- [x] 5.3 A `permissionRequest` raised by a stage appears on the chain's
  stream with the stage's run id.
- [x] 5.4 Under `autonomous`, a stage whose agent raises a permission
  request fails, and the message names the request.
- [x] 5.5 **Replaces the original 5.5 per design.md**: "a test that would
  pass if it used the watched run id must fail" is unfalsifiable while a
  stage publishes under the chain's own runId and the panel drops events
  whose runId differs from the one it watches. Instead: (a) a
  `HarnessChainPanel` test with two distinct `permissionRequest` events
  observed in sequence asserts that answering the second sends that
  event's own `requestId`, not the first; (b) the pair assertion from
  task 2.2 (already covered by
  `harness-chain-runner.test.ts`'s "carries a permissionRequest event
  through with the pair a fake driver then resolves against").

## 6. Verification

- [x] 6.1 `openspec change validate --strict chain-answers-a-permission-request`.
- [x] 6.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [x] 6.3 Version bump via `npx changeset`: `core` and both hosts.
- [x] 6.4 Document in the extension README that a chain can now be
  answered, beside the existing harness entry.
- [x] 6.5 **Human-only**: run a chain on an agent that asks for
  permission — `copilot-cli-acp` is the one that does — at
  `semi-autonomous`, answer Allow, and confirm the stage continues rather
  than stalling. Then run the same at `autonomous` and confirm it fails
  with the stated reason instead of hanging. The second half is the one
  that was found the hard way.
