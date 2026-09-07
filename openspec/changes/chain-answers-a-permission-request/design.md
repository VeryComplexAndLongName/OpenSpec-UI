## Context

Read on 2026-09-07 from this repository, at the commit this change is
planned against (`dde6f5c`). Line numbers are from that read.

- `HarnessChainRunner.runStage()` builds its stage command with the
  chain's own `runId` — `harness-chain-runner.ts:712` passes `runId`
  straight through, per ADR 0012 ("every event ... is published under
  `command.runId`", `harness-chain-runner.ts:258-262`). A stage therefore
  does not have an id of its own.
- `AcpSessionDriver` keys a pending request `${runId}:${requestId}`
  (`agents/acp-session-driver.ts:231`) and matches on the same key in
  `resolvePermission` (`:169-176`), which returns `false` — a no-op, not
  an error — when nothing is pending.
- `createAgentRunner` already handles a `"resolvePermission"` command
  without spawning anything: it reaches into the adapter that is mid-run
  for that `runId` and yields no events (`agent-runner.ts:108-121`).
- `ChainState` already carries `currentRunner`/`currentCommand`
  (`harness-chain-runner.ts:98-101`), set before the stage's event loop
  (`:713-714`) and cleared after it (`:729-730`). `cancel()` uses that
  pair to re-send a `"cancel"` command to the stage's own runner and
  drains the result (`:312-325`).
- `asAgentRunner()` special-cases `"cancel"` only
  (`harness-chain-runner.ts:340-364`); everything else falls to `run()`,
  which rejects any non-`"chain"` kind with a failed event (`:264-267`).
- Neither host routes `"resolvePermission"` to the chain. The standalone
  server branches on `confirmCheckpoint`/`cancel`/`chain`
  (`server/src/websocket.ts:88-106`) and sends everything else to
  `dispatchSingleStage`, which picks a runner by `command.agentId`
  (`:119`) — `undefined` for the answer the panel sends, so the default
  agent. The extension branches the same three kinds
  (`extension/src/webview/ai-panel.ts:362-396`) and sends the rest to
  `dispatchOrRun`, which resolves a runner by `command.agentId` too
  (`:256-271`).
- `HarnessChainPanel.tsx` has no permission handling of any kind.
  `AiPanel.tsx` has all of it (`:929-943` pending-request selection,
  `:1032-1043` the send, `:1115-1135` the control).

Two corrections to `proposal.md`, both of which change what the fix has
to be:

1. **The ids already match.** A stage runs under the chain's `runId`
   (`:712`), so the `${runId}:${requestId}` the driver stores is exactly
   what a surface watching the chain would have sent. The proposal's
   "even if the command had been forwarded, `runId:requestId` would not
   have matched" does not hold. Nothing needs to rewrite or translate an
   id, and no id-mapping table should be built. Task 3.2 stays worth
   doing — answer from the event, not from the watched run — but as
   locality, not as a repair.
2. **`asAgentRunner()` is not on the path the operator's click takes.**
   The extension starts a chain through
   `runController.run(chainRunner.asAgentRunner(), command)`
   (`ai-panel.ts:394`), but `RunController` only re-sends to that stored
   runner from `cancel()` (`run-controller.ts:150-156`); a fresh
   `"resolvePermission"` message from the webview goes through
   `handleWebviewMessage` to `dispatchOrRun` and never reaches the chain.
   The standalone server never uses `asAgentRunner()` at all
   (`websocket.ts:103-104` calls `chainRunner.run` directly). So task 1.1
   alone fixes nothing an operator can see: **both hosts need the same
   early branch they already have for `confirmCheckpoint`/`cancel`.**
   See "Scope gap" below.

Also observed, and it explains the twelve silent minutes better than the
routing bug alone: the extension excludes `"cancel"` from
`trackHarnessProcess` (`ai-panel.ts:164`) because a Processes entry was
once created for a command that never produces a terminal event.
`"resolvePermission"` is not excluded, and produces no terminal event
either — so the click created a Processes entry that waits forever.

What could not be reproduced from the code: the claim that the operator's
Allow/Deny controls were `AiPanel`'s. The extension renders `AiPanel`
**or** `HarnessChainPanel`, never both (`extension-entry.tsx:126-133`),
and the standalone shell mounts both but `AiPanel` drops every event
whose `runId` is not the one it started itself. Recorded here so nobody
spends the same hour on it; it does not change the work, because the gap
task 3 names — a chain panel with no way to answer — is real either way.

## Goals / Non-Goals

**Goals:**

- An answer to a permission request raised by a stage reaches the adapter
  that raised it, from both hosts.
- A chain whose stage asks for permission under `autonomous` ends with a
  stated reason and no surviving subprocess.
- The chain panel can answer what it displays.

**Non-Goals:**

- Answering on the operator's behalf, at any level (proposal, "Explicitly
  out of scope").
- A general command dispatcher. Two kinds are forwarded; the second one
  is written beside the first, not abstracted over it.
- Any change to the id a stage publishes under.

## Decisions

### A public `resolvePermission` on the chain runner, mirroring `cancel`

`HarnessChainRunner` gains `resolvePermission(command: Command): boolean`
beside `confirmCheckpoint(runId)` and `cancel(runId)`. It looks up
`this.active.get(command.runId)`; if there is no such chain it returns
`false` so a host falls through to its existing single-stage path
unchanged. If there is a chain but no `currentRunner` (between stages, or
paused at a checkpoint) it returns `true` and does nothing — the chain
owns that `runId`, and an answer naming no pending request is a no-op
(task 1.5). Otherwise it forwards `command` **verbatim** to
`state.currentRunner`.

It takes the whole `Command` rather than `(runId, requestId, outcome)`
precisely so "unchanged" (task 1.3) is structural rather than a promise
in a comment.

**Forwarding must drain the returned iterable.** `AgentRunner.run` is an
async generator: calling it without iterating executes none of its body,
so the answer would be dropped exactly as silently as it is today. Reuse
the `void (async () => { for await (const _ of ...) {} })()` shape
`cancel()` already uses (`harness-chain-runner.ts:316-325`), with the
same "draining only" reasoning.

**Rejected alternative**: have the chain call
`adapter.resolvePermission` itself. The chain holds an `AgentRunner`, not
an adapter, and `AgentRunner.resolvePermission` is the adapter-level
optional hook (`agent-runner.ts:40-47`) — reaching past the runner would
duplicate the sandbox-bypass reasoning that `agent-runner.ts:108-121`
already states in one place.

### `asAgentRunner()` routes the kind, and yields nothing

`asAgentRunner()` gains a `"resolvePermission"` branch calling the method
above and returning an empty async generator. No acknowledging event: the
protocol has no non-terminal "answered" kind, `cancelling` was added for
cancel because a *terminal-looking* silence was the problem there, and
here the stage's own stream resuming is the evidence. Adding an event
kind is a protocol change and would need an ADR.

This branch is not what makes the operator's click work — the host
branches are — but it keeps the two adaptations of the same runner
consistent, and it is where the third forwarded kind will go.

### The held runner is cleared in a `finally`

Task 1.4 asks for clearing on every path. Today `:729-730` runs only if
the stage's `for await` completes normally; a consumer abandoning the
chain generator mid-stage leaves a stale runner behind. Wrap the stage
loop in `try { ... } finally { state.currentRunner = undefined;
state.currentCommand = undefined; }`.

### `permissionRequest` needs no forwarding work, and one test to prove it

`runStage` already yields every non-`completed` event through
(`:719-727`), and the stage publishes under the chain's `runId`, so task
2.1 is satisfied by the code as it stands. It is still worth a test, and
the test is the one task 2.2 specifies: assert that the `(runId,
requestId)` pair observed on the chain's stream is the pair a fake driver
then resolves — not that a field looks plausible.

### Under `autonomous`, the stage fails *and* the process is ended

In `runStage`'s event loop, when
`harnessConfig.autonomyLevel === "autonomous"` and an event is
`permissionRequest`:

1. yield the `permissionRequest` first, so the record says what was
   asked;
2. yield `failed` with the reason naming the request:
   `a permission request cannot be answered under autonomyLevel
   "autonomous": <event.description>` (task 4.2 — the description is the
   tool-call title the driver already built,
   `acp-session-driver.ts:224-228`);
3. end the stage's process by re-sending a `"cancel"` command to
   `state.currentRunner`, exactly as `cancel()` does;
4. keep draining the stage's stream but suppress its terminal events, so
   the chain reports one outcome and not a `failed` followed by a
   `cancelled`;
5. return `"failed"`, which stops the chain at `:488`.

**Rejected alternative**: `break` out of the loop. Abandoning the
generator runs `agent-runner.ts`'s `finally` (`:200-215`), which records
the audit entry and deletes the `activeRuns` entry but **does not abort
the controller** — and the ACP driver's permission handler is parked on a
promise nobody can resolve (`acp-session-driver.ts:230-232`). The CLI
subprocess would outlive the chain. That is the symptom the report
describes, not a fix for it.

**Rejected alternative**: auto-deny. A denial is an answer, and task 4.3
excludes answering. Cancelling ends the run instead of speaking for the
operator.

*Known residue, deliberately not fixed here:* killing the process leaves
the driver's `pending` entry in place (`acp-session-driver.ts:231`). It
is keyed by a `runId` that can never recur, so it can never be matched —
a small bounded leak per killed run, in a map that lives as long as the
adapter. Out of this change's tasks; name it as a successor rather than
fixing it silently.

### The panel shares `AiPanel`'s permission rendering, not its send

`HarnessChainPanel` already imports `collapseStreamEvents`/`isTerminal`/
`renderEventBody` from `AiPanel.tsx` (`HarnessChainPanel.tsx:14`,
justified at `AiPanel.tsx:133-139`). Extend that precedent: export from
`AiPanel.tsx` a `findPendingPermissionRequest(events, resolvedIds)`
helper (the loop at `:935-943`) and a presentational
`PermissionRequestPrompt` (the block at `:1115-1135`), and have each
panel keep its own `resolvedPermissionRequestIds` state and its own send.

That satisfies task 3.4 as written — `AiPanel` neither gains a control
for chain runs nor answers one — while keeping one copy of "which request
is still pending" and one copy of the markup. The chain panel's send uses
`event.runId` and `event.requestId` from the event object, never
`runIdRef.current` (task 3.2).

**Rejected alternative**: copy the twenty lines into
`HarnessChainPanel`. Two copies of the pending-request rule drift, and
this is the change that exists because a rule lived in one surface only.

## Scope gap to resolve before implementing

`proposal.md`'s Impact names `harness-chain-runner.ts` and
`HarnessChainPanel.tsx`. As established above, the answer cannot reach
the chain from either host without a routing branch in
`packages/server/src/websocket.ts` (beside `:88-106`) and
`packages/extension/src/webview/ai-panel.ts` (beside `:362-396`).
Recommend widening the change through `openspec-update-change` before
writing code:

- Impact gains both host files; the changeset gains `@openspec-ui/server`.
- A task under section 1 for the host branches (`1.6`), stating that a
  `false` return falls through to the single-stage path unchanged.
- A task for excluding `"resolvePermission"` from `trackHarnessProcess`
  (`ai-panel.ts:164`), which today opens a Processes entry that can never
  terminate. Adjacent, one line, and the same "an answer is not work"
  idea; it should still be written down before it is done.
- Task 5.5 as worded cannot be honoured: "a test that would pass if it
  used the watched run id must fail" is unfalsifiable while a stage
  publishes under the chain's own id, and the panel drops events whose
  `runId` differs from the one it watches, so a differing-id event can
  never reach the control. Replace with the two tests that do bite: the
  panel answers with the *event's* `requestId` when two requests have
  been seen, and the core-level pair assertion from task 2.2.

If widening is refused, the honest outcome is a core-only fix that no
operator can reach, and that must be stated in `tasks.md` rather than
ticked.

## Implementation order

1. `packages/core/src/harness-chain-runner.ts`: `resolvePermission`
   method; `asAgentRunner()` branch; `try/finally` around the stage loop;
   the `autonomous` interception in `runStage`. Tasks 1.1-1.5, 2.1, 4.x.
2. `packages/core/src/harness-chain-runner.test.ts`: tasks 5.1-5.4, and
   the pair assertion for 2.2. The fake runners already in that file
   extend to this; the `autonomous` case needs the fixture change's own
   `harness.json` to set it, since `autonomous` is refused unless the
   change's own file sets it directly (`:392-406`).
3. `packages/server/src/websocket.ts` and
   `packages/extension/src/webview/ai-panel.ts`: the routing branches,
   plus the `trackHarnessProcess` exclusion, with host tests beside the
   existing chain-cancel ones.
4. `packages/webui/src/components/AiPanel.tsx`: extract the two shared
   pieces, leaving `AiPanel`'s own behaviour byte-identical (its existing
   tests are the check).
5. `packages/webui/src/components/HarnessChainPanel.tsx` and its test:
   the control, the resolved-id set, the send from the event.
6. `packages/extension/README.md` beside `## Agentic Harness` (`:200`):
   one sentence that a chain run can now be answered. Task 6.4.
7. `npx changeset`: `@openspec-ui/core` minor (new public method),
   `@openspec-ui/webui` minor, `openspec-ui-vscode` minor,
   `@openspec-ui/server` patch.

## Verification

`openspec change validate --strict chain-answers-a-permission-request`,
then `npm run typecheck && npm run lint && npm run test` workspace-wide
on an idle machine, then the live smoke test the runbook requires for
`server`/`extension`. Tick each item after it passes, not before the
commit (`openspec/README.md`, "Tick a verification item after it
passes").

Task 6.5 stays open until a person runs a chain on `copilot-cli-acp` at
`semi-autonomous`, answers Allow, and sees the stage continue — and then
runs the same at `autonomous` and sees it fail with the stated reason.
Note that this change's own `harness.json` sets `autonomous`, so a
harness run of it will exercise the new failure path on itself if its
agent asks for anything.

## Risks

- **The `autonomous` interception fires while the chain is already
  ending.** The suppression of terminal events must be scoped to the
  branch that set the failure, not to the whole loop, or it will swallow
  a `cancelled` the operator asked for.
- **Draining the forwarded answer hides a throw.** The drain loop should
  be as silent as `cancel()`'s, but a runner that throws synchronously on
  an unknown command would produce an unhandled rejection; keep the
  body inside a `try`, in both the new path and the cancel path it
  copies.
- **The `AiPanel` extraction regresses the single-stage path.** Mitigated
  by leaving `AiPanel`'s behaviour untouched and relying on its existing
  tests (`AiPanel.test.tsx`) rather than rewriting them.
