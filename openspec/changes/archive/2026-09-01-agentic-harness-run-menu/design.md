## Context

See `openspec/changes/agentic-harness-autonomy/design.md` for the chain
protocol this change's entry point drives. This document covers only the
entry-point dispatch; it adds no new protocol members.

## Goals / Non-Goals

**Goals:**

- One discoverable action per change, in both delivery targets, that does
  the right thing for whatever autonomy level that change's harness config
  resolves to, without the user needing to know the difference between
  "open the picker" and "start a chain."

**Non-Goals (this change):**

- Not adding any new command/event protocol member — purely a UI dispatch
  over what `agentic-harness-autonomy` already exposes.
- Not changing what `assisted`/`semi-autonomous`/`autonomous` actually do
  during execution — that behavior is entirely owned by
  `agentic-harness-autonomy`.
- Not adding a way to force a specific autonomy level from this menu entry
  (e.g. "run assisted anyway even though config says autonomous") — the
  entry always honors the resolved config; overriding it means editing the
  harness config itself (`openspec-ui.configureHarnessForChange`), not a
  parallel escape hatch here.

## Decisions

### Dispatch lives in `packages/webui`, not duplicated per host

The "which flow to open" decision (`assisted` → picker, else → chain panel)
is implemented once in a shared component; `packages/extension`'s command
handler and `standalone-entry.tsx`'s button both call into it, per ADR
0001's shared-core/shared-ui invariant. Rejected alternative: a VS Code
command that reimplements the dispatch natively — rejected because it
would duplicate logic the extension's own webview already has access to
via the shared package, for no native-API benefit (no VS Code-specific
capability is needed here beyond the context-menu contribution itself).

### Menu entry always resolves fresh, never caches the autonomy level

Each invocation re-resolves the harness config (global + per-change) at
click time, rather than reusing a value read when the tree was last
rendered — a user may have just edited the per-change `harness.json` via
`openspec-ui.configureHarnessForChange` immediately before running.

## Risks / Trade-offs

- **[Risk]** A user expects "Run with Agentic Harness" to always mean
  "fully autonomous," and is surprised when an `assisted`-configured change
  just opens the picker instead of doing anything automatically.
  → **Mitigation**: the command's tooltip/description text explicitly
  states it "runs the next stage according to this change's Agentic
  Harness configuration," and the Harness Settings UI remains the single
  place autonomy level is set — this entry point never overrides it.

## Migration

None — additive command/button only.
