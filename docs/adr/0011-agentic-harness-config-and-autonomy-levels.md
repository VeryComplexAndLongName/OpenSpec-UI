# ADR 0011: Agentic Harness config and autonomy levels

Status: Proposed

Date: 2026-08-30

## Context

This repository is now routinely worked by multiple concurrent AI coding
agents at once (e.g. an architect/reviewer role and one or more separate
implementer agents), each a real CLI tool already supported by this
product's own `AgentRunner` abstraction (`packages/core/src/agents/
registry.ts`, `buildDefaultAgentRunners()` — Claude CLI, GitHub Copilot
CLI, Codex CLI, Gemini CLI, a local LLM). Today there is no way to
declare, in a way visible and editable in this product's own GUI, which
agent should handle which stage of an OpenSpec change (propose/review/
apply/archive), nor any gate before a change's work is committed and
pushed.

ADR 0002 ("Direct OpenSpec mode") removed autonomous multi-step
AI-agent execution from the primary command-panel UX, because the agent
path was found unreliable and produced poor UX in both delivery targets.
That finding is not being relitigated here — it remains the correct
default. What has changed is the specific, narrower use case: a human
repository owner explicitly assigning specific CLI-agent tools to
specific OpenSpec-change stages, under a configurable review gate, is a
different risk profile than the fully automatic in-panel agent execution
ADR 0002 removed.

Two further concrete findings from investigating the actual codebase
before writing this ADR:

1. `openspec/config.yaml` (the file the upstream `openspec` CLI reads)
   has a fixed Zod schema (`schema`/`context`/`rules`/`operations`/
   `store` — see `@fission-ai/openspec`'s `project-config.js`) parsed
   with `safeParse()`. Unknown top-level keys are silently dropped, not
   validated or acted on. Any harness configuration must therefore live
   in a file this product owns and reads itself — it cannot be added as
   new keys inside `openspec/config.yaml`.
2. `packages/core/src/git.ts`'s `GitWrapper.commit()` exists but is not
   currently called from anywhere in the product (no command, no UI
   button), and no `push()` exists at all. A "git" role in this harness
   is therefore not gating an existing feature — it is new,
   security-relevant functionality that needs the same rigor as the
   CLI-agent orchestration security model already required by
   `execution-core` (command allowlist, cwd sandbox, audit — see
   `CLAUDE.md`'s "Invariants").

## Decision

Adopt a new, product-owned Agentic Harness configuration layer, and
authorize (but do not, in this ADR alone, fully implement) three
autonomy levels for it:

- **Config ownership and location**: a new global file,
  `openspec/agent-harness.json`, plus an optional per-change override,
  `openspec/changes/<id>/harness.json`, deep-merged over the global
  file. Neither file is part of the upstream `openspec` CLI's schema;
  both are read and written only by this product's own code
  (`packages/core`, new module).
- **`stepAgents`**: maps an OpenSpec change stage (`propose`, `review`,
  `apply`, `archive`) and a `git` role to a preferred `agentId` from the
  existing `AgentRunner` registry.
- **`autonomyLevel`**: `"assisted"` (default) | `"semi-autonomous"` |
  `"autonomous"`.
  - `assisted`: the Agent Selection picker pre-fills the configured
    agent for the current stage; a human still explicitly starts every
    run. No protocol change required.
  - `semi-autonomous`: a single action runs a sequence of stages,
    pausing for explicit confirmation between each one by default
    (`checkpoints.requireConfirmationBetweenSteps`). Requires an
    extension to the existing command/event protocol; that extension's
    concrete shape is out of scope for this ADR and needs its own
    design.md before implementation.
  - `autonomous`: a stage's completion automatically starts the next
    stage with no pause. This ADR explicitly does **not** authorize this
    level as usable by default under any circumstance: it is only ever
    reachable through an explicit, per-change, human-authored
    `harness.json` override — never a global default, and never implied
    by any other setting. This preserves ADR 0002's core finding
    (predictable-by-default UX) while allowing an explicit,
    accountability-bearing escape hatch for a specific change whose
    owner has decided to trust it.
- **`reviewGate`**: `mode` is `"human-required"` (global default) or
  `"agent-sufficient"` (only settable per-change, in that change's
  `harness.json`; never a global default). The `git` stepAgent may not
  execute a commit/push while the gate has not passed. Whoever is
  configured as the `review` stepAgent is the accountable party for any
  per-change decision to relax the gate to `agent-sufficient` — the
  gate's accountability is tied to that assignment, not anonymous.
- **Parallel task execution** (running independent `tasks.md` checklist
  items concurrently within one change) is explicitly deferred to a
  later change and a later ADR revision. It requires a real isolation
  mechanism (each parallel task in its own `git worktree`, merged before
  the change's single end-of-change commit) that does not exist yet, and
  compounds the semi/autonomous execution risk with a new
  filesystem-concurrency risk that has no existing infrastructure to
  lean on.
- **Process visibility**: `WorkbenchProcess` (`packages/core/src/
  process-scheduler.ts`) gains an `agentId?: string` field. Percent-
  complete, where shown, is computed from the existing `completedTasks`/
  `totalTasks` returned by `readTaskChecklist` (`task-checklist.ts`) —
  not by parsing the free-text `progress` event field, which is
  explicitly documented as "not necessarily numeric." A dedicated
  graph/DAG visualization of harness step sequencing is deferred until
  `semi-autonomous` step-chaining actually exists to visualize; the
  existing flat Processes view is extended (not replaced) for the
  `assisted`-level scope this ADR's first implementation change covers.

## Rejected alternatives

### Encode harness configuration as new keys inside `openspec/config.yaml`

Rejected: verified from `@fission-ai/openspec`'s own source that its
config schema is a fixed Zod object; unknown keys are silently dropped
by `safeParse()`. Anything added there would look configured but do
nothing — worse than an explicit separate file, which at least fails
predictably (unrecognized by nothing, since it's this product's own).

### Direct model/provider selection (e.g. `provider: anthropic, model: claude-3-7-sonnet`)

Rejected: conflicts with this product's existing, deliberate execution
model — it shells out to each CLI-agent tool's own binary, which manages
its own authentication and model selection, and "never handles API keys
or credentials directly" (see root `README.md`, "Agent Selection").
Reintroducing direct provider/model bindings would require bypassing or
duplicating that abstraction.

### Ship `autonomous` level as usable by default from the start

Rejected: this is, functionally, the same class of automatic multi-step
agent execution ADR 0002 found unreliable, without new evidence that the
underlying reliability problem is solved. Only accepted as an explicit,
non-default, per-change, human-authored opt-in — see Decision above.

### Build parallel task execution in the same change as the config schema

Rejected: no isolation mechanism exists yet (see Decision above), and
building it correctly is independent, substantial work that would bloat
this change and delay the safe, low-risk `assisted`-level functionality
that does not depend on it.

## Consequences

- New config file format and a new `packages/core` module to read/merge/
  write it; no changes to the upstream `openspec` CLI's own config file.
- `semi-autonomous` requires a follow-up design.md and its own protocol-
  extension work before implementation — this ADR authorizes the
  direction, not the concrete protocol shape.
- A "git" role/action is new, security-relevant product functionality
  (commit/push do not currently exist as a user-facing feature at all)
  and must get the same rigor (allowlist/sandbox/audit posture) as the
  existing CLI-agent orchestration security model before it ships.
- Related OpenSpec change: `openspec/changes/agentic-harness/`.
