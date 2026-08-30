## Why

See `docs/adr/0011-agentic-harness-config-and-autonomy-levels.md` for the
full architectural rationale. Concrete pain point: this repository is now
routinely worked by multiple concurrent AI coding agents (an architect/
reviewer role plus one or more separate implementer agents), each already
supported as an `AgentRunner` (`packages/core/src/agents/registry.ts`).
There is currently no way, visible or editable in this product's own
GUI, to declare which agent should handle which stage of an OpenSpec
change, nor any review gate before a change's work is committed and
pushed.

Two findings from the codebase (not assumptions) shaped this proposal's
scope: (1) the upstream `openspec` CLI's config schema is a fixed Zod
object that silently drops unrecognized keys — harness configuration
cannot live inside `openspec/config.yaml`, it needs its own,
product-owned file; (2) `GitWrapper.commit()` exists in `packages/core/
src/git.ts` but is not called from anywhere in the product today, and no
`push()` exists at all — a "git" role is new, security-relevant
functionality to build, not a wrapper around an existing feature.

This proposal covers the **assisted** autonomy level only (agent
recommendation, no automatic multi-step execution) plus the config
schema that also defines (but does not yet implement) `semi-autonomous`
and `autonomous`. It deliberately excludes the `git`/commit-push action
itself, `semi-autonomous` step-chaining, `autonomous` execution, and
parallel task execution — each needs its own follow-up change; see
design.md's "Non-Goals" and tasks.md's phasing.

## What Changes

- New product-owned config: `openspec/agent-harness.json` (global
  default) and an optional per-change `openspec/changes/<id>/
  harness.json` (deep-merged override). Neither is read by the upstream
  `openspec` CLI.
- `stepAgents`: maps `propose`/`review`/`apply`/`archive`/`git` to a
  preferred `agentId` from the existing `AgentRunner` registry.
- `autonomyLevel` (`assisted` default / `semi-autonomous` /
  `autonomous`) and `reviewGate.mode` (`human-required` global default /
  `agent-sufficient`, only settable per-change) are defined in the
  schema now, for forward compatibility, even though only `assisted` +
  `human-required` are functionally wired up in this change.
- Agent Selection picker (both delivery targets) pre-fills the
  recommended agent for the currently open change/stage from
  `stepAgents`, instead of always defaulting to the last-used agent. The
  human still explicitly starts every run — no change to the existing
  command/event protocol.
- `WorkbenchProcess` (`packages/core/src/process-scheduler.ts`) gains an
  optional `agentId` field, set when a process is started via the Agent
  Selection picker.
- Processes view (both delivery targets) shows, for a process tied to an
  active change, a percent-complete derived from that change's existing
  `completedTasks`/`totalTasks` (`readTaskChecklist`) — not from the
  free-text `progress` event field.
- New GUI surface: "Harness Settings" (global, edits `openspec/
  agent-harness.json`) and a per-change "Configure Harness for this
  Change" action (edits `openspec/changes/<id>/harness.json`), in both
  delivery targets.

## Capabilities

### New Capabilities

- `agentic-harness`: two-level (global + per-change) configuration
  mapping OpenSpec-change stages to preferred CLI agents, an
  `autonomyLevel`/`reviewGate` schema (only `assisted`/`human-required`
  functional in this change), and GUI surfaces to view/edit both config
  levels.

### Modified Capabilities

- `execution-core`: `WorkbenchProcess` gains `agentId`.
- `shared-ui`: Agent Selection picker pre-fill, Harness Settings UI,
  Processes view percent-complete.
- `vscode-extension`: same UI additions natively (tree/command surface
  for Harness Settings).

## Impact

- `packages/core/src/harness-config.ts` (new): read/merge/write the two
  config levels.
- `packages/core/src/process-scheduler.ts`: `WorkbenchProcess.agentId`.
- `packages/webui/src/components/`: new Harness Settings component;
  Agent Selection + Processes view changes.
- `packages/extension/src/tree/` + `src/commands.ts`: Harness Settings
  tree entry/commands.
- `docs/adr/0011-agentic-harness-config-and-autonomy-levels.md` (new,
  Status: Proposed — this change's implementation should not proceed
  until this ADR is Accepted).
