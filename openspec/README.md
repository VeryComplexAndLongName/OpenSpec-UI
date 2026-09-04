# OpenSpec in this repository — runbook

## Implementation Order

Dependencies between changes are strict; `server`/`webui`/`extension` rely
on the protocol defined in `execution-core`:

1. `openspec/changes/execution-core/` first. It defines the command/event
   protocol and the security model that everything else depends on.
2. `openspec/changes/shared-ui/` after `execution-core` (or in parallel if the
   protocol is already fixed in design.md and will not change).
3. `openspec/changes/standalone-app/` and `openspec/changes/vscode-extension/`
   in parallel; both depend on `execution-core` + `shared-ui`.

## Change Governance (mandatory)

All repository changes must be implemented through an OpenSpec change entry.
Do not bypass OpenSpec with direct ad-hoc commits, even for documentation,
tests, tooling, or refactoring.

Required flow for every change:

1. Create or update a change in `openspec/changes/<id>/`.
2. Keep implementation scoped to `tasks.md` for that change.
3. Validate with `openspec change validate --strict <id>`.
4. Archive only after all required verification is complete.

Reason: this keeps a full audit trail, supports safer rollback decisions, and
preserves implementation history in a single structured process.

### Tick a verification item after it passes, not before the commit

`tasks.md` is what decides whether a change may be archived, so it has to
say what is true. Run the verification items, then tick them, then commit.

The order that goes wrong is: tick what you believe you are about to
finish, copy the files into a worktree, commit, and only then run the
checks and `npx changeset`. Those last two results land after the commit
that would have recorded them, so the file ships saying they were never
done. This produced the same omission on four changes in a row, always at
the last two items of a list — "run the checks" and "add a changeset" —
and once left an entire shipped change reading as untouched (see
`task-bookkeeping-catch-up`).

From outside it looks like this: a change whose work is plainly in `main`,
whose `tasks.md` reads as though nothing was started, and which the
archive step then refuses. If you meet that, correct the record against
the repository — the code, the test, the released `CHANGELOG.md` entry —
and never in bulk from memory.

An item marked **human-only** stays open until a person reports it done.
Passing automated checks are not evidence for it, and neither is half of
it having been observed.

## Architecture Changes via ADR (mandatory)

Any architecture-impacting modification must be documented via ADR in
`docs/adr/` before the implementation is considered complete.

Examples include:

- Delivery model changes (standalone vs extension responsibilities)
- Protocol changes (commands/events, transport behavior)
- Security model changes (allowlist, cwd sandbox, audit boundaries)
- Moving business logic across package boundaries

The related OpenSpec change must reference the ADR decision.

## Which command/skill to use when

| Situation | Action |
|---|---|
| Start implementing `execution-core`/`shared-ui`/`standalone-app`/`vscode-extension` | `openspec-apply-change` — follows the `tasks.md` of the prepared change |
| New capability beyond the original four | `openspec-propose` |
| Change implemented and confirmed (green contract tests, manual smoke test) | `openspec-archive-change` — see `operations.archive.guidance` in `config.yaml` for what must be confirmed before archiving |
| Adjust a change that is not archived yet (new information, mistake in design.md) | `openspec-update-change` |
| Fix wording in an already archived spec without a full cycle | `openspec-sync-specs` |

## How to ask the agent

- **For apply**: "apply change `execution-core`" — the agent reads
  `tasks.md` and follows the list. Security-model tasks (allowlist/cwd
  sandbox/audit) are not marked complete without a test — see `rules.tasks`
  in `config.yaml`.
- **For archive**: only after contract tests between `webui` and
  `server`/`extension` have actually passed — not when it merely "looks
  ready".
- **If the command/event protocol changes** (see `context` in `config.yaml`
  for the full list), explicitly tell the agent that already implemented
  adapters are affected so that design.md captures backward compatibility or
  an explicit breaking change.

## Agentic Harness — how to work with it

Full rationale: `docs/adr/0011-agentic-harness-config-and-autonomy-levels.md`
and `docs/adr/0012-agentic-harness-chain-execution-protocol.md`. Normative
behavior: `openspec/specs/agentic-harness/spec.md`. This section is the
short, practical version.

**Config files** — two levels, both product-owned (never read by the
upstream `openspec` CLI):

- `openspec/agent-harness.json` — global default for the whole repository.
- `openspec/changes/<id>/harness.json` — optional per-change override,
  merged key-by-key over the global file (only the keys it sets are
  overridden; everything else is inherited).

Fields: `stepAgents` (maps `propose`/`review`/`apply`/`archive`/`git` to a
preferred `agentId` from `packages/core/src/agents/registry.ts`),
`autonomyLevel`, and `reviewGate.mode`.

**Three ways to edit either file:**

1. "Harness Settings" tab in the standalone webui, or the VS Code commands
   `OpenSpec UI: Configure Harness Settings` (global) and
   `OpenSpec UI: Configure Harness for this Change` (per-change, from the
   Changes tree context menu).
2. Hand-editing the JSON directly — it is validated on read/write either
   way, so a malformed edit fails with a clear error rather than being
   silently ignored.

**What each `autonomyLevel` does today:**

- `assisted` (default): the Agent Selection picker in both delivery
  targets pre-fills the `stepAgents` recommendation for the stage being
  opened; a human still explicitly starts every `plan`/`review`/
  `implement` run.
- `semi-autonomous`: a `"chain"` command runs `propose → review → apply →
  archive` in sequence, pausing at an explicit `checkpoint` between each
  stage by default (Continue/Cancel) unless a per-change `harness.json`
  sets `checkpoints.requireConfirmationBetweenSteps: false`.
- `autonomous`: same chain, no pause between stages
  (`stageCompleted` events only) — reachable **only** through an explicit
  per-change `openspec/changes/<id>/harness.json` setting
  `autonomyLevel: "autonomous"` directly; the global file can never set it,
  and it is never implied by any other setting.

Either chain level always stops after `archive` and never invokes the
`git` stepAgent — commit/push automation is still fully out of scope (see
`reviewGate.mode` below). See `docs/adr/0012-agentic-harness-chain-
execution-protocol.md` for the full chain protocol and
`openspec/changes/agentic-harness-autonomy/` for the implementation.

**Starting a run:** "Run with Agentic Harness" — a context-menu command on
a change in the VS Code extension, or a button in the standalone shell's
Change Editor tab (`openspec/changes/agentic-harness-run-menu/`) — resolves
the change's harness config fresh on every invocation and dispatches
accordingly: opens the Agent Selection picker for `assisted`, or starts a
chain (rendered in `HarnessChainPanel`, with the checkpoint Continue/Cancel
choice) for `semi-autonomous`/`autonomous`. It never overrides what the
resolved config says — change the config (above) to change the behavior.

**`reviewGate.mode`**: `human-required` (the only valid global value) or
`agent-sufficient` (per-change file only). This gate is meant to govern the
`git` stepAgent's commit/push action — but that action does not exist as a
product feature yet (`GitWrapper.commit()`/`push()` are not called from
anywhere), so today `reviewGate.mode` has no observable runtime effect
either way. It is safe to set, and already enforces its own validation
rules (global can never be `agent-sufficient`), but nothing currently reads
it to gate an action.

**Where the resolved config shows up today:** the Agent Selection picker's
pre-fill and the "Run with Agentic Harness" dispatch (both above), and the
Processes view, which shows the `agentId` that started a process and a
percent-complete derived from that change's `tasks.md` checklist.
