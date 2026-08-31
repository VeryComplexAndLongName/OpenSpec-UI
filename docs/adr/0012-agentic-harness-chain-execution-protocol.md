# ADR 0012: Agentic Harness chain-execution protocol (`semi-autonomous`/`autonomous`)

Status: Accepted

Date: 2026-08-31

## Context

ADR 0011 introduced the Agentic Harness config (`openspec/agent-harness.json`
+ per-change `harness.json`) and shipped only the `assisted` autonomy level:
`stepAgents` pre-fills the Agent Selection picker, but a human still
explicitly starts every single-stage run (`plan`/`review`/`implement`) via
the existing command/event protocol, unmodified. ADR 0011 deliberately left
`semi-autonomous` and `autonomous` as schema-only values, stating that
wiring them up "requires an extension to the existing command/event
protocol; that extension's concrete shape is out of scope for this ADR and
needs its own design.md before implementation."

This ADR proposes that concrete shape. Two things stay fixed from ADR 0011
and are not reopened here: (1) `autonomous` is never reachable through the
global `openspec/agent-harness.json`, only through an explicit per-change
`openspec/changes/<id>/harness.json`; (2) the `git` stepAgent's actual
commit/push action is out of scope — chaining SHALL stop cleanly before any
git action regardless of `autonomyLevel`/`reviewGate.mode`, until a
follow-up change gives that action the same allowlist/cwd-sandbox/audit
rigor already required of CLI-agent orchestration (`execution-core`).

A gap found while writing this ADR: `packages/extension/schemas/
agent-harness.schema.json`'s global schema restricts `reviewGate.mode` to
`"human-required"` only, but does **not** similarly restrict `autonomyLevel`
— the global file's schema and `harness-config.ts`'s
`assertValidAutonomyLevel` currently accept `"autonomous"` at the global
level without error, silently defeating ADR 0011's stated intent ("never a
global default"). This ADR closes that gap as part of the same change that
makes `autonomous` functional (fixing it earlier, before it does anything,
would be a no-op; fixing it now, alongside making the value dangerous for
the first time, is the point where it actually matters).

A second latent loophole: ADR 0011 says `semi-autonomous` "pauses ... by
default (`checkpoints.requireConfirmationBetweenSteps`)" but never defines
where that field may be set. Read literally, a global `harness.json` setting
`autonomyLevel: "semi-autonomous"` plus `checkpoints.
requireConfirmationBetweenSteps: false` would reach unpaused, repository-wide
multi-stage execution — functionally identical to `autonomous` — without
ever writing `"autonomous"` anywhere, bypassing the per-change-only
restriction ADR 0011 places on that specific string. This ADR treats
disabling the pause as carrying the same risk as `autonomous` itself and
restricts it the same way (see Decision below).

## Decision

### New protocol members (additive, backward compatible)

Added to `packages/core/src/protocol.ts`:

- `CommandKind`: `"chain"` (starts a harness-driven multi-stage run) and
  `"confirmCheckpoint"` (resumes a chain paused at a checkpoint). Existing
  `CommandKind` values and their behavior are unchanged; a client that never
  sends `"chain"` sees no behavior change at all.
- `EventKind`: `"stageCompleted"` (a chain's current stage finished and the
  chain is continuing — not terminal) and `"checkpoint"` (a `semi-autonomous`
  chain paused after a stage, awaiting `"confirmCheckpoint"` or `"cancel"` —
  not terminal). Existing `EventKind` values keep their existing meaning;
  `"completed"`/`"failed"`/`"cancelled"` remain the only terminal kinds and
  are reserved, for a chain run, for when the **whole chain** ends (not each
  stage).

A `"chain"` run reuses the same `runId` across every stage it executes —
`stdout`/`stderr`/`progress`/`started` events from each stage's underlying
`plan`/`review`/`implement` execution are published on that one `runId`
exactly as they are for a standalone single-stage command today, so an
event-log renderer that doesn't know about chains still renders something
coherent (it degrades to seeing extra `started` events between stages,
which is already how a normal per-stage `started` event reads). Only
`"checkpoint"`/`"stageCompleted"` are genuinely new information.

### Stage sequencing and stopping points

A chain runs through `propose → review → apply → archive`, in that fixed
order, starting from the change's first not-yet-complete stage (reusing the
existing status/`readTaskChecklist` signal already used by the `status`
command — no new "is this stage done" mechanism). It SHALL stop after
`archive` (a purely mechanical, non-agent step already implemented) and
SHALL NOT invoke the `git` stepAgent under any configuration — this is a
hard stop in the runner, not merely something the config happens not to
request yet.

### `assisted` (no chain)

Unchanged from ADR 0011: no chain, the human starts each stage.
`"chain"`/`"confirmCheckpoint"` are refused with a clear `failed` event if
the resolved `autonomyLevel` is `"assisted"`.

### `semi-autonomous`

Each stage's `completed` (from the underlying single-stage execution) is
translated into a `"checkpoint"` event (carrying the finished stage, the
next stage, and the next stage's resolved `stepAgents` agent) instead of
being forwarded as-is, unless `checkpoints.requireConfirmationBetweenSteps`
resolves to `false` for that change, in which case it is forwarded as
`"stageCompleted"` and the next stage starts immediately (same as
`autonomous`'s per-stage behavior). The client resumes a paused chain with
`"confirmCheckpoint"`; `"cancel"` on the same `runId` ends the whole chain
(not just the current stage — the current stage already finished).

### `autonomous`

Every stage transition is `"stageCompleted"` (never `"checkpoint"`) — no
pause. Reachable only when resolved from an explicit per-change
`harness.json` (see Decision below); a `"chain"` request that resolves
`autonomyLevel: "autonomous"` from any other source is refused with a
`failed` event citing this restriction.

### Closing the two loopholes found in Context

- `assertValidAutonomyLevel` (`harness-config.ts`) and the global JSON
  schema (`packages/extension/schemas/agent-harness.schema.json`) are
  tightened: the **global** `openspec/agent-harness.json` may only set
  `autonomyLevel` to `"assisted"` or `"semi-autonomous"`; `"autonomous"` is
  rejected there with a new `GlobalAutonomousAutonomyLevelError`, exactly
  mirroring the existing `GlobalAgentSufficientReviewGateError` pattern for
  `reviewGate.mode`.
- `checkpoints.requireConfirmationBetweenSteps: false` follows the same
  per-change-only rule as `reviewGate.mode: "agent-sufficient"` and
  `autonomyLevel: "autonomous"`: valid only in a per-change `harness.json`,
  rejected (new `GlobalCheckpointsDisabledError`) if set in the global file.
  The chain runner additionally re-derives this from the per-change file
  directly (the same pattern already used for the `autonomous` check) rather
  than trusting the already-merged `HarnessConfig`, so provenance is never
  lost across the merge.

### Cancellation

The existing `"cancel"` `CommandKind`, targeted at a chain's `runId`, aborts
whichever stage is currently running (or the whole chain, if paused at a
checkpoint) and emits the existing `"cancelled"` event — no new command
needed for this path.

## Rejected alternatives

### Orchestrate the chain client-side (webui), no protocol change

Rejected: the decision of "what stage is next," "is this change's autonomy
level actually reachable" (the per-change-only checks above), and "should
this stage's completion pause or continue" is harness domain logic, not
view logic — duplicating it between `packages/webui` (shared, but still one
of two independent render targets) risks drift the same way the invariant
"business logic lives only in core" already guards against for
`server`/`extension`. It would also die with the webview: an `autonomous`
chain that outlives the panel being open (a real scenario for the level ADR
0011 explicitly designed as an "accountability-bearing escape hatch") has no
runtime left to drive it forward once the UI closes if the UI is what's
sequencing the stages.

### A per-stage fresh `runId`, with the client stitching them into one chain view

Rejected: pushes correlation logic ("which of these five runIds belong to
one chain, in what order") onto every consumer, for no benefit over reusing
one `runId` and adding two new non-terminal event kinds. The chosen design
keeps every existing single-stage renderer path unmodified.

### Let `"chain"` accept an explicit stage list from the caller

Rejected for this ADR: always starting from the first incomplete stage
through `archive` is simpler, matches how a human would use it, and avoids
a caller accidentally re-running an already-complete stage. Revisit only if
a concrete use case for partial/custom chains shows up.

## Consequences

- `packages/core/src/protocol.ts`, `harness-config.ts`, and a new chain
  runner module gain real logic; `server`/`extension` transports gain
  pass-through support for the two new `CommandKind`s and two new
  `EventKind`s (thin, per ADR 0001 — no new business logic in either).
- `packages/webui` needs a new chain-aware panel/view (`checkpoint`
  confirmation UI, `stageCompleted` progress indication) — reusing
  `AiPanel`'s existing single-run rendering for anything not already
  new-event-kind-aware.
- The `git` stepAgent and real commit/push automation remain fully out of
  scope; a chain simply cannot reach that stage yet, by construction.
- Related OpenSpec change: `openspec/changes/agentic-harness-autonomy/`.
