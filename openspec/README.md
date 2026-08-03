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

## When to create a new OpenSpec entry vs a plain commit

```
Does the contract (`## Requirement`) in openspec/specs/* change?
├── Yes → propose (or update, if the change is still active) → apply → archive
└── No — bug fix/refactor without behavior changes
      → plain git commit with a detailed message
```

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
