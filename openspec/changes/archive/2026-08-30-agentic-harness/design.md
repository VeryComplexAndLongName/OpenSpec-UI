## Context

See `docs/adr/0011-agentic-harness-config-and-autonomy-levels.md`. This
document covers the implementation-level decisions for the `assisted`-
level slice specifically; `semi-autonomous`/`autonomous`/parallel
execution each need their own design.md once their own change is
proposed.

## Goals / Non-Goals

**Goals:**
- A human can, per repository and per change, declare a preferred CLI
  agent for each OpenSpec-change stage, visible and editable from both
  delivery targets' GUI, without editing JSON by hand (though the files
  remain plain, readable JSON for anyone who prefers that).
- The config schema itself already models `semi-autonomous`/
  `autonomous`/`reviewGate.agent-sufficient` so that a later change can
  wire them up without a breaking schema change — but this change does
  not implement any behavior for them beyond accepting and round-
  tripping the values.
- Percent-complete and per-process agent attribution reuse existing data
  (`completedTasks`/`totalTasks`, the `AgentRunner` registry) rather than
  inventing a parallel tracking mechanism.

**Non-Goals (this change):**
- Not implementing `semi-autonomous` step-chaining or any protocol
  extension for it.
- Not implementing `autonomous` execution.
- Not implementing the `git` stepAgent's actual commit/push action —
  `GitWrapper.commit()` stays uncalled from product code until a
  follow-up change gives it the same security rigor (allowlist/sandbox/
  audit posture) already required of CLI-agent orchestration.
- Not implementing parallel task execution or any per-task worktree
  isolation mechanism.
- Not building a graph/DAG visualization — the existing flat Processes
  view is extended with `agentId` and a percent-complete column; a real
  step-sequencing graph has nothing real to visualize until
  `semi-autonomous` chaining exists.

## Decisions

### Config file location: product-owned JSON, not `openspec/config.yaml`

Verified directly in `@fission-ai/openspec`'s own source
(`project-config.js`): its `ProjectConfigSchema` is a fixed Zod object
(`schema`/`context`/`rules`/`operations`/`store`), parsed with
`safeParse()`, which silently drops unrecognized keys rather than
erroring. Anything added to `openspec/config.yaml` beyond that schema
would look configured in the file but do nothing when the CLI actually
reads it. `openspec/agent-harness.json` and `openspec/changes/<id>/
harness.json` are therefore separate files this product's own code
owns, reads, and validates — never touched by the upstream `openspec`
CLI, and not subject to `openspec change validate --strict`.

### Merge semantics: per-change is a partial deep-merge over global, key by key

A per-change `harness.json` may set only the keys it wants to override
(e.g. only `reviewGate.mode`) and inherit everything else from the
global file — not an all-or-nothing replacement. `stepAgents` merges per
stage-key (overriding `apply` doesn't drop `propose`/`review`/`archive`/
`git` from the global default).

### `reviewGate.mode: "agent-sufficient"` is per-change-only, never global

Matches the accountability model requested directly: whoever is
configured as the `review` stepAgent for a change is the one implicitly
accountable if that change's `harness.json` relaxes the gate — global
relaxation would make that accountability anonymous. The global default
stays `"human-required"` unconditionally; the schema does not offer a
global `"agent-sufficient"` value at all (not merely defaulted away from
it — actually absent as a valid global setting), so a careless global
edit cannot silently disable the human gate repository-wide.

### Percent-complete source: `completedTasks`/`totalTasks`, not the `progress` event field

`packages/core/src/protocol.ts` documents the `progress` event's payload
as "Arbitrary human-readable progress message (not necessarily
numeric — specific agents report progress differently)." Parsing it for
a number would be unreliable and agent-dependent. `readTaskChecklist`
(`task-checklist.ts`) already computes `completedTasks`/`totalTasks` from
the change's real `tasks.md` checkbox state — an existing, reliable,
already-computed signal.

### Agent Selection pre-fill is advisory, never enforced

At `assisted` level, `stepAgents` only changes which agent is
pre-selected when the picker opens for a given change/stage — the user
can still pick a different agent before running. This keeps the change
entirely additive to the existing picker behavior and requires no
protocol change.

## Risks / Trade-offs

- **[Risk]** Two config files (global + per-change) could appear to
  disagree if their merge precedence isn't obvious to someone reading
  them. → **Mitigation**: `harness-config.ts`'s merge function is the
  single source of truth for precedence, covered by a unit test suite
  asserting exact merge output for representative global+override
  combinations (including partial per-key overrides), not just "does it
  return something."
- **[Risk]** Defining `semi-autonomous`/`autonomous` values in the
  schema now, before they do anything, could read as those levels being
  supported when they are not. → **Mitigation**: `autonomyLevel` values
  beyond `"assisted"` are accepted and persisted (so a user's stated
  intent isn't lost/rejected), but the GUI and any process-launching
  code path explicitly ignore them for now and behave identically to
  `"assisted"`, with a visible "not yet implemented" indicator in the
  Harness Settings UI next to those options — never a silent no-op that
  looks like it worked.
- **[Risk]** Someone reads `docs/adr/0011-*.md`'s "Proposed" status as
  already-decided and starts building `semi-autonomous`/`autonomous`/
  `git`-action work against it. → **Mitigation**: `docs/adr/README.md`'s
  index already marks it `Proposed` (not `Accepted`); this proposal's
  own tasks.md is scoped to only the `assisted`-level work regardless of
  the ADR's eventual acceptance status for the rest.
