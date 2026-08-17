## Why

`docs/adr/0007-ci-cli-third-delivery-target.md` documents the gap: this
repository's own `.github/workflows/quality.yml` has no automated check
that every active `openspec/changes/*` entry is still strictly valid —
today that only ever got caught by a human running `openspec change
validate --strict <id>` manually (as happened repeatedly earlier in this
session, once per change, with no aggregation). `packages/core/src/
openspec.ts`'s `listChanges`/`validateChange` already implement the
underlying check; neither existing delivery target (`server`'s HTTP API,
`extension`'s VS Code UI) is the right shape for a CI merge gate, which
needs a single process that lists every active change, validates each,
and exits non-zero if any fail — the ADR chose a third, minimal adapter
over inventing this ad hoc inside the workflow YAML or reusing an
interactive delivery target for a non-interactive check.

## What Changes

- Add `packages/cli` (`@openspec-ui/cli`): a `validate` command that
  lists every active change via `listChanges()`, runs `validateChange()`
  (strict) on each, and prints an aggregated report — JSON by default
  (`{ ok, results: [...] }`), `--format text` for a human-readable table.
- Distinct exit codes: `0` all valid, `1` at least one change failed
  validation, `2` the check itself could not complete (bad args, missing
  `openspec` CLI, etc.) — so CI can tell "your change is broken" apart
  from "the tooling broke."
- Wire it into this repository's own CI (`.github/workflows/quality.yml`)
  as a real merge gate against `openspec/changes/`, not just an unused
  capability.
- Ships unbundled, run via `tsx` (`npm run start --workspace
  @openspec-ui/cli -- validate`), matching how `server`'s dev entry point
  is already consumed — no new packaging/publishing pipeline.

## Capabilities

### New Capabilities

- `ci-cli`: a non-interactive, third thin adapter over `@openspec-ui/core`
  that validates every active OpenSpec change and reports an aggregated,
  machine-readable result with a CI-actionable exit code.

### Modified Capabilities

(none — this is additive; no existing capability's behavior changes.)

## Impact

- New package `packages/cli` (`src/openspec-validate.ts` for the logic,
  `src/cli.ts` for the argv/exit-code bin entry).
- `.github/workflows/quality.yml` gains a step running the new command.
- `docs/adr/0007-ci-cli-third-delivery-target.md` (new ADR, referenced
  here per `config.yaml`'s architecture-impacting-change rule).
- `README.md` (documentation of the new package/command).
- No change to `packages/core`'s public surface, the command/event
  protocol, or either existing delivery target.
