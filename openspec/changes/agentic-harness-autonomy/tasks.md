## 0. Gate

- [x] 0.1 Do not begin tasks 1-6 until `docs/adr/0012-agentic-harness-
  chain-execution-protocol.md`'s status is `Accepted` (this proposal/
  design/tasks may be written and reviewed first, per the same pattern
  `openspec/changes/archive/2026-08-30-agentic-harness/tasks.md` 5.2 used
  for ADR 0011). Accepted 2026-08-31 — tasks 1-6 may now begin.

## 1. Protocol: two new command/event members

- [x] 1.1 `packages/core/src/protocol.ts`: add `"chain"` and
  `"confirmCheckpoint"` to `CommandKind`/`COMMAND_KINDS`; add
  `"stageCompleted"` and `"checkpoint"` to `EventKind`, with their own
  interfaces (`StageCompletedEvent { stage, nextStage }`,
  `CheckpointEvent { stage, nextStage, nextAgentId }`) and `isEvent()`
  branches. `stage`/`nextStage` reuse `HarnessStage`, extracted (along
  with its `STAGES` runtime array) into a new zero-import leaf module,
  `harness-stage.ts` — `protocol.ts` must stay free of `harness-config.ts`'s
  Node-only imports (`node:fs/promises`/`node:path`), which the browser
  client bundle (`packages/core/src/browser.ts`) would otherwise pull in
  transitively (caught by `packages/server/src/static.test.ts`'s esbuild
  build). Also required adding `"chain"`/`"confirmCheckpoint"` cases to
  `agents/shared.ts`'s `commandInstruction()` (throws — a chain never
  invokes a CLI agent with those kinds itself) and to the `describeEvent()`
  helpers in `packages/extension/src/describe-event.ts` and
  `packages/webui/src/components/AiPanel.tsx`, both pre-existing exhaustive
  switches over `EventKind`.
- [x] 1.2 Unit tests in `protocol.test.ts` (or equivalent): `isEvent()`
  accepts well-formed `stageCompleted`/`checkpoint` events and rejects
  malformed ones (missing `stage`/`nextStage`), matching the existing
  per-kind test pattern for `completed`/`failed`.

## 2. `HarnessConfig`: `checkpoints` field and tightened validation

- [x] 2.1 `packages/core/src/harness-config.ts`: add `checkpoints?:
  { requireConfirmationBetweenSteps: boolean }` to `HarnessConfig`;
  `assertValidHarnessConfigInput` validates its shape. Threaded the
  existing `allowGlobalAgentSufficient` boolean through as a renamed
  `isPerChangeFile`, now gating `autonomyLevel`/`checkpoints` too, not just
  `reviewGate.mode`; `mergeHarnessConfig`/`readGlobalHarnessConfig` updated
  to carry `checkpoints` through like every other field.
- [x] 2.2 New `GlobalAutonomousAutonomyLevelError`: global
  `openspec/agent-harness.json` setting `autonomyLevel: "autonomous"` is
  rejected (mirrors `GlobalAgentSufficientReviewGateError`'s exact pattern
  — same file, same error-class shape).
- [x] 2.3 New `GlobalCheckpointsDisabledError`: global file setting
  `checkpoints.requireConfirmationBetweenSteps: false` is rejected.
- [x] 2.4 `packages/extension/schemas/agent-harness.schema.json`: restrict
  the global schema's `autonomyLevel` enum to `["assisted",
  "semi-autonomous"]`; add the `checkpoints` object shape (`enum: [true]`
  on `requireConfirmationBetweenSteps`, matching `reviewGate.mode`'s
  single-value-enum pattern for a global-only-fixed field). Also updated
  `change-harness.schema.json` to accept `checkpoints` with either boolean
  — required so a per-change file setting `false` (now valid at runtime
  per 2.3's per-change carve-out) isn't flagged by VS Code's JSON
  validation; not explicitly listed in this task but a direct correctness
  consequence of it.
- [x] 2.5 Unit tests: both new rejections (global file, each field, both
  the `write*` and hand-edited-then-`read*` path, matching the existing
  `GlobalAgentSufficientReviewGateError` test pair); confirm a
  **per-change** `harness.json` setting either value is still accepted
  (existing per-change-allows-more-than-global pattern, same as
  `reviewGate.mode`); two added `mergeHarnessConfig` cases for
  `checkpoints` inheritance/override, mirroring the existing
  `reviewGate.mode` pair.

## 3. `HarnessChainRunner` (new module)

- [x] 3.1 New `packages/core/src/harness-chain-runner.ts`: given a
  workspace root + change name, resolves harness config, determines the
  first not-yet-complete stage (`propose`/`review`/`apply`/`archive`, via
  the existing `readTaskChecklist`/status signal plus a `proposal.md`/
  `design.md` presence check for `propose`), and runs stages in sequence
  through the existing single-stage execution path (same `AgentRunner`
  security model, unmodified — no new allowlist/sandbox surface). Actual
  implementation uses `statusChange()`'s `artifacts[]`/`progress.remaining`
  (the same signal the `status` command already reports) rather than a
  separate presence check — `review` has no durable artifact in the
  upstream schema, so a chain resuming after `propose` is already done
  starts directly at `apply` (documented in the module as a deliberate
  simplification, not a gap).
- [x] 3.2 Between stages: emit `checkpoint` and wait for
  `confirmCheckpoint` (or `cancel`) when the resolved config requires it
  (`semi-autonomous` and `checkpoints.requireConfirmationBetweenSteps` is
  not explicitly `false` from a per-change file); otherwise emit
  `stageCompleted` and continue immediately. The pending-checkpoint
  resolver is registered *before* the `checkpoint` event is yielded (not
  after) — a consumer reacting synchronously to the event would otherwise
  race the generator's own resumption and be silently dropped; caught by
  this task's own tests hanging before the fix.
- [x] 3.3 `autonomous` gate: before starting a chain, independently read
  the per-change `harness.json` (not the merged config) and refuse (clear
  `failed` event) if the resolved `autonomyLevel` is `"autonomous"` but the
  per-change file itself does not set it.
- [x] 3.4 Hard stop: the chain never invokes the `git` stepAgent under any
  configuration — after `archive` completes (or if `archive` was the only
  remaining stage), the chain ends with the existing `completed` event.
- [x] 3.5 `cancel` targeting a chain's `runId` aborts the current stage (or
  the paused checkpoint) and ends the chain with `cancelled`. Mid-stage
  cancellation mirrors the existing single-stage convention
  (`RunController.cancel()`: re-send a `"cancel"`-kind `Command` to the
  same runner) as a best effort — this product has no hard child-process
  -kill mechanism for any single-stage run today (`agents/shared.ts`'s
  `spawnAndStream` wires no `AbortSignal` to the spawned process), so this
  guarantees the CHAIN stops advancing, not that the underlying CLI
  process exits early; documented in the module rather than overclaimed.
- [x] 3.6 Unit tests (`harness-chain-runner.test.ts`, 11 tests, all
  green): full `semi-autonomous` chain with a checkpoint at each
  transition; confirming a checkpoint resumes into the next stage's agent;
  full `autonomous` chain with no checkpoints (per-change file sets it);
  the `autonomous`-without-per-change-file refusal (simulated via a
  spied `readChangeHarnessConfig` disagreeing with the merged config); the
  `git`-stage hard stop (archive succeeds, no `AgentRunner` invoked, chain
  ends with `completed`); cancellation at a checkpoint and mid-stage; a
  paused chain surviving (not silently completing) across two consecutive
  checkpoints when not immediately resumed.

## 4. Transport pass-through (`server`, `extension`)

- [x] 4.1 `packages/server`: `websocket.ts`'s `handleSocketMessage` routes
  `"chain"` to a process-lifetime `HarnessChainRunner` (constructed once in
  `server.ts`, reused across messages — a paused chain's state lives
  between them) through the SAME `recovery.runMutating` mutation-lock/
  cross-host-lease path `"implement"` already uses (a chain's `apply`/
  `archive` stages mutate the repo exactly like a standalone `implement`);
  `"confirmCheckpoint"` and a `"cancel"` that names an active chain's
  `runId` are routed directly to the chain runner, never reaching a plain
  `AgentRunner`.
- [x] 4.2 `packages/extension`'s message-bridge transport
  (`webview/ai-panel.ts`): same three-way routing
  (`chain`/`confirmCheckpoint`/chain-`cancel`), reusing the existing
  `RunController`/`onEvent` event-forwarding path unchanged via a new
  `HarnessChainRunner.asAgentRunner()` adapter (added to task 3's module —
  needed so `RunController`'s existing single-active-run tracking, built
  for a plain `AgentRunner`, works for a chain without a parallel
  bookkeeping mechanism); `trackHarnessProcess` now marks a `"chain"`
  command `mutating: true` for the same reason as 4.1.
- [x] 4.3 Contract tests: `server.test.ts` — a real WS round-trip (chain
  command → `checkpoint` event over the wire → `cancel` resolves it →
  `cancelled`), with `cross-spawn` mocked for `HarnessChainRunner`'s
  `statusChange` call (matching `harness-chain-runner.test.ts`'s own
  pattern, not the real CLI). `ai-panel.test.ts` — four tests: chain start
  dispatches through `asAgentRunner()` and tracks it as mutating,
  `confirmCheckpoint`/chain-`cancel` bypass `runController.run()`
  entirely, and a `cancel` for an unknown (non-chain) `runId` still falls
  back to the pre-existing generic single-stage cancel path.

## 5. Chain-run view (minimal, `packages/webui`)

- [x] 5.1 New `HarnessChainPanel` component (`packages/webui/src/
  components/HarnessChainPanel.tsx`): starts a chain for a given change,
  renders `checkpoint` as an explicit "Continue to `<stage>` with
  `<agent>`?" confirmation (Confirm → `confirmCheckpoint`, Cancel →
  `cancel`), and any other event (including `stageCompleted`) via
  `AiPanel.tsx`'s own `renderEventBody`/`collapseStreamEvents`/
  `isTerminal` — exported from that module (previously private) rather
  than duplicated, per design.md's "Chain-run view: a new component, not
  AiPanel extended in place".
- [x] 5.2 This is intentionally minimal — no menu entry, no tree
  integration; `agentic-harness-run-menu` wires this component into both
  delivery targets' UX.
- [x] 5.3 Component tests (`HarnessChainPanel.test.tsx`, 7 tests, all
  green): starting a chain, checkpoint confirmation flow (renders the
  choice, Continue sends `confirmCheckpoint`, Cancel sends `cancel`),
  mid-run cancellation (no pending checkpoint), a completed summary
  re-enabling the start button, and events from a different `runId` being
  ignored.

## 6. Spec, ADR status, and verification

- [x] 6.1 `openspec/specs/agentic-harness/spec.md` delta (this change's
  `specs/agentic-harness/spec.md`) — `ADDED Requirements` for chain
  execution, `MODIFIED Requirements` for the tightened global validation.
- [x] 6.2 `docs/adr/0012-...md`'s status flipped to `Accepted` (and
  `docs/adr/README.md`'s table row) — accepted 2026-08-31.
- [x] 6.3 `openspec change validate --strict agentic-harness-autonomy` —
  passes.
- [x] 6.4a typecheck/lint/test for `core`, `server`, `webui`, `extension`
  (workspace-wide `npm run typecheck`/`npm run lint`/`npm run test`) — all
  green. One pre-existing, unrelated failure observed
  (`core/src/sprint-report.test.ts`'s "aggregates authorship..." test:
  Windows-only temp-directory `rmdir` race under parallel test load,
  `EBUSY`/timeout) — reproduced on `main` before this change's own work
  started, passes cleanly in isolation (`vitest run src/sprint-report.test.ts`
  alone), not touched by any file this change modifies. Not fixed here —
  out of scope for `agentic-harness-autonomy`.
- [ ] 6.4b Real Extension Host smoke test exercising one full
  `semi-autonomous` chain (checkpoint confirm) and one full `autonomous`
  chain, per this project's established live-verification requirement —
  **not performed**: requires an interactive VS Code Extension Development
  Host session, which this agent cannot drive. Blocks archiving this
  change per `openspec/config.yaml`'s archive guidance ("do not archive a
  change if even one scenario from specs/ was not actually verified") —
  needs a human (or a session with Extension Host access) to run it before
  archive.
- [x] 6.5 Version bump via `npx changeset` — `.changeset/
  agentic-harness-autonomy.md` added (`minor` for `core`/`server`/`webui`/
  `openspec-ui-vscode`), not yet applied (`npx changeset version` is a
  separate, later step per this repo's workflow, not part of an individual
  change).

## Explicitly out of scope for this change (tracked for follow-up changes, not tasks here)

- The "Run with Agentic Harness" context-menu entry and any tree/command
  integration in either delivery target — `agentic-harness-run-menu`.
- The `git` stepAgent's actual commit/push action and its security model.
- Parallel task execution / worktree isolation.
