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
