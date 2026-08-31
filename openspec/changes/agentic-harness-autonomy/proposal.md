## Why

See `docs/adr/0012-agentic-harness-chain-execution-protocol.md` for the full
architectural rationale. `docs/adr/0011-agentic-harness-config-and-
autonomy-levels.md` shipped only the `assisted` autonomy level
(`openspec/changes/archive/2026-08-30-agentic-harness/`); `semi-autonomous`
and `autonomous` are accepted by the config schema but do nothing — a human
must still explicitly start every `plan`/`review`/`implement` run. ADR 0011
explicitly deferred wiring these up, pending "its own design.md" — ADR 0012
is that design.md's architectural decision; this proposal is the
implementation-level change.

Two findings while writing ADR 0012 (not assumptions) shape this proposal's
scope: (1) the global `openspec/agent-harness.json` schema and
`assertValidAutonomyLevel` currently accept `autonomyLevel: "autonomous"`
without error, silently defeating ADR 0011's stated "never a global
default" intent — this is a real gap this change also closes; (2) ADR
0011's mention of `checkpoints.requireConfirmationBetweenSteps` was never
actually added to the schema, and read literally would let a global
`semi-autonomous` config disable its own pause and become functionally
`autonomous` without ever setting that string anywhere — this change closes
that loophole by restricting `requireConfirmationBetweenSteps: false` the
same way `autonomous` and `reviewGate.agent-sufficient` are already
restricted (per-change file only).

## What Changes

- `packages/core/src/protocol.ts`: two new `CommandKind` values (`"chain"`,
  `"confirmCheckpoint"`) and two new `EventKind` values (`"stageCompleted"`,
  `"checkpoint"`) — additive, existing command/event behavior unchanged.
- New `packages/core/src/harness-chain-runner.ts`: resolves the harness
  config for a change, determines the first not-yet-complete stage
  (`propose`/`review`/`apply`/`archive`, reusing the existing
  `readTaskChecklist`/status signal), and drives stages in sequence,
  emitting `checkpoint` (pausing, `semi-autonomous` default) or
  `stageCompleted` (continuing immediately, `autonomous` or
  `requireConfirmationBetweenSteps: false`) between them. Stops after
  `archive`; never invokes the `git` stepAgent.
- `packages/core/src/harness-config.ts`: add `checkpoints?:
  { requireConfirmationBetweenSteps: boolean }` to `HarnessConfig`; new
  `GlobalAutonomousAutonomyLevelError` (global file may not set
  `autonomyLevel: "autonomous"`) and `GlobalCheckpointsDisabledError`
  (global file may not set `requireConfirmationBetweenSteps: false`) —
  both only valid in a per-change `harness.json`, mirroring the existing
  `GlobalAgentSufficientReviewGateError` pattern.
- `packages/extension/schemas/agent-harness.schema.json`: restrict the
  global schema's `autonomyLevel` enum to `["assisted", "semi-autonomous"]`
  (matching the code-level restriction above); add the `checkpoints` shape
  to both the global and (forthcoming) per-change schema.
- `packages/server`/`packages/extension`: thin pass-through of the two new
  command/event kinds over their existing transports (REST+WS,
  message-bridge) — no new business logic in either, per ADR 0001.
- `packages/webui`: a new chain-aware view (reusing `AiPanel`'s existing
  single-stage rendering for the parts that still apply) that starts a
  chain, renders `checkpoint` as an explicit "Continue to `<stage>` with
  `<agent>`?" confirmation, and `stageCompleted` as ongoing progress.
- `openspec/specs/agentic-harness/spec.md`: new requirements for chain
  execution, the tightened `autonomyLevel`/`checkpoints` validation, and the
  `git`-stage hard stop.

This proposal deliberately excludes: the actual "Run with Agentic Harness"
menu entry (follow-up `openspec/changes/agentic-harness-run-menu/`, which
consumes the API this change produces) and the `git` stepAgent's real
commit/push action (still fully out of scope, per ADR 0011 and ADR 0012).

## Capabilities

### New Capabilities

(none — this extends the existing `agentic-harness` capability)

### Modified Capabilities

- `agentic-harness`: `semi-autonomous` and `autonomous` become functional;
  new `checkpoints` config field; tightened global-file validation.
- `execution-core`: two new `CommandKind`/`EventKind` protocol members.
- `shared-ui`: new chain-run view/component.

## Impact

- `packages/core/src/protocol.ts`, `harness-config.ts`,
  `harness-chain-runner.ts` (new).
- `packages/extension/schemas/agent-harness.schema.json`.
- `packages/server/src/`, `packages/extension/src/webview/`: transport
  pass-through for the two new protocol members.
- `packages/webui/src/components/`: new chain-run view.
- `docs/adr/0012-agentic-harness-chain-execution-protocol.md` (new, Status:
  Proposed — this change's implementation should not begin until this ADR
  is Accepted, mirroring `openspec/changes/archive/2026-08-30-agentic-
  harness/tasks.md`'s own gate on ADR 0011).
