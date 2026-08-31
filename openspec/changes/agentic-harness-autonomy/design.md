## Context

See `docs/adr/0012-agentic-harness-chain-execution-protocol.md` for the
architectural decision this document implements. This covers the
`semi-autonomous`/`autonomous` chain-execution slice specifically; the "Run
with Agentic Harness" menu entry that triggers a chain from the UI is a
separate, dependent change (`openspec/changes/agentic-harness-run-menu/`).

## Goals / Non-Goals

**Goals:**

- A change whose resolved harness config is `semi-autonomous` can run
  `propose → review → apply → archive` as one supervised action, pausing
  for an explicit human confirmation between each stage by default.
- A change whose resolved harness config is `autonomous` — reachable only
  through an explicit per-change `harness.json`, never the global file —
  can run the same sequence with no pause.
- Existing single-stage `plan`/`review`/`implement`/`status`/`list`/`show`/
  `validate`/`cancel` behavior is completely unaffected; a transport or
  client that never sends `"chain"` sees no behavior change.
- The two loopholes found while writing ADR 0012 (global `autonomous`,
  global `requireConfirmationBetweenSteps: false`) are closed with the same
  rigor as the existing `reviewGate.agent-sufficient` restriction.

**Non-Goals (this change):**

- Not implementing the "Run with Agentic Harness" menu entry or any other
  UI trigger beyond the minimal chain-run view needed to exercise/test the
  new protocol members — see `agentic-harness-run-menu`.
- Not implementing the `git` stepAgent's actual commit/push action. A chain
  stops after `archive`, unconditionally.
- Not implementing parallel task execution (unrelated, deferred by ADR 0011
  for its own worktree-isolation reasons).
- Not changing `reviewGate.mode` semantics beyond what ADR 0011 already
  defined — `agent-sufficient` still only means "the `git` stepAgent may
  commit/push," which still cannot happen (no git action exists), so a
  chain currently behaves identically under either `reviewGate.mode` value.

## Decisions

### Protocol change: two new `CommandKind`, two new `EventKind` (additive)

Per ADR 0012. `packages/core/src/protocol.ts`'s `COMMAND_KINDS` array and
`isEvent()`'s switch both gain the new members, so `server`'s
`isCommandLike`-style boundary checks and `extension`'s message-bridge
validation pick them up automatically rather than needing a second
hand-maintained list.

**Backward compatibility**: `server` (REST/WS) and `extension`
(message-bridge) are both already-implemented adapters. Neither currently
special-cases `CommandKind`/`EventKind` values (they serialize/deserialize
generically per `protocol.ts`), so passing through the two new members
requires no shape change to their wire formats — verified by extending
their existing contract tests (see tasks.md 4) rather than assumed.

### Chain runner lives in `packages/core`, not `webui`

Rejected alternative and reasoning: see ADR 0012's "Rejected alternatives"
(client-side orchestration duplicates domain logic across two render
targets and cannot outlive a closed webview). `HarnessChainRunner` is built
on top of the same `AgentRunner`/security-model primitives `execution-core`
already uses for single-stage commands — it does not call CLI agents
itself, it sequences calls to the existing plan/review/implement execution
path.

### `checkpoints.requireConfirmationBetweenSteps` provenance is re-derived, not trusted from the merged config

`mergeHarnessConfig()`'s output has no memory of which file a given key
came from. Rather than adding provenance tracking to the general merge
(which every other call site would then have to ignore), the chain runner
independently reads the per-change `harness.json` (if any) via the existing
`readChangeHarnessConfig()` and checks whether *it itself* sets
`autonomyLevel: "autonomous"` or `checkpoints.
requireConfirmationBetweenSteps: false`, before ever consulting the merged
result for those two specific fields. This is the same pattern
`GlobalAgentSufficientReviewGateError`'s validation already uses
(per-file validation, not post-merge inspection).

### Stage detection reuses the existing status signal

No new "is this stage done" mechanism: the chain runner asks the same
`readTaskChecklist`-backed status logic the `status` command already uses,
and additionally checks for `proposal.md`/`design.md` presence for the
`propose` stage (a change with no tasks yet has nothing for
`readTaskChecklist` to report). Rejected alternative: a dedicated "change
lifecycle state" field written by each stage on completion — rejected as
new state that could drift from the actual filesystem contents it would be
describing.

### Chain-run view: a new component, not `AiPanel` extended in place

`AiPanel` is unit-tested against today's single-run, single-terminal-event
model (`isTerminal()` treats any `completed`/`failed`/`cancelled` as
ending the run). Interleaving `checkpoint`/`stageCompleted` into that
component's state machine risks regressing the existing, already-covered
single-stage flow. A new `HarnessChainPanel` (name provisional) owns the
chain-specific rendering and reuses `AiPanel`'s existing structured-event
renderers (`renderEventBody`, `parseStructuredText`, etc. — extracted where
needed) rather than duplicating them.

## Risks / Trade-offs

- **[Risk]** A chain that pauses at a `checkpoint` and is then abandoned
  (webview closed, user walks away) leaves a `WorkbenchProcess` sitting in
  a paused state indefinitely. → **Mitigation**: the existing Processes
  view already surfaces long-running/stale processes; no new mechanism
  needed here, but tasks.md includes a test confirming a paused chain shows
  up there like any other in-flight process, not as silently "completed."
- **[Risk]** Reusing one `runId` across stages means a client that
  naively counts `"started"` events per `runId` (assuming exactly one per
  run) will see several for a chain. → **Mitigation**: this is already true
  today in spirit (nothing currently promises exactly-one-`started`), but
  is called out explicitly in `protocol.ts`'s doc comment for `"chain"`.
- **[Risk]** Closing the two validation loopholes (global `autonomous`,
  global `requireConfirmationBetweenSteps: false`) is itself a breaking
  change for anyone who (incorrectly, but not currently rejected) already
  set either in their global `openspec/agent-harness.json` before this
  change ships. → **Mitigation**: this repository's own
  `openspec/agent-harness.json` and the archived `agentic-harness` change's
  shipped defaults never set either value at the global level (verified),
  so no existing configuration in this repository is affected; the new
  validation error messages name the exact field and required file
  location so any future misconfiguration is immediately actionable.
- **[Trade-off]** A hard stop after `archive` (never reaching `git`) means
  `autonomous` today still ends with an uncommitted working tree — the
  "autonomy" is real but partial until the deferred git-action change
  lands. This is the explicit, accepted scope boundary from ADR 0011/0012,
  not an oversight.
- **[Considered, not pursued here]** The deferred `git` stepAgent action
  needs exactly the shape ACP (Agent Client Protocol — Zed's JSON-RPC
  protocol between an editor/client and a coding agent, including a
  permission-request/approval flow before a tool call executes) already
  provides: propose a mutating action, get it approved, then apply it.
  Checked locally against the CLIs this product's `AGENT_REGISTRY`
  actually adapts: `copilot` (1.0.78) exposes `--acp` ("Start as Agent
  Client Protocol server") directly; `claude` (2.1.237) does not expose
  ACP in its CLI surface today (only its own interactive
  `--permission-mode`); `gemini-cli`/`codex-cli` were not verified (not
  installed in the environment this was checked from). Since `claude-cli`
  is this product's `DEFAULT_AGENT_ID`, ACP cannot be *the* mechanism for
  the git stage without leaving the default agent unable to use it — at
  best it is an additive, per-adapter capability (e.g. a `copilot-cli-acp`
  adapter) alongside whatever non-ACP allowlist/sandbox/audit mechanism
  the deferred git-action change ends up needing for every other agent.
  Also relevant to a possible future revisit: ACP's per-tool-call
  granularity would let a chain expose confirmation *inside* a stage (not
  just between stages, as today), but only for whichever agents actually
  support it. Not pursued as part of this change or its immediate
  follow-ups — noted here so the git-action change doesn't have to
  re-discover this from scratch.

## Migration

No data migration. Existing `openspec/agent-harness.json`/`harness.json`
files remain valid as-is (the new `checkpoints` field is optional and
defaults to "confirmation required" wherever it matters); the tightened
`autonomyLevel` validation only rejects a value (`"autonomous"` at the
global level) that was always contrary to the documented intent and, per
the risk above, is not present in this repository's own config today.
