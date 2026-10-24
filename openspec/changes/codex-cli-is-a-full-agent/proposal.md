## Why

The owner will use Codex (installed: `codex` 0.164.0). A review of the
integration on 2026-10-24, and four trial runs of `codex exec` that day,
found the raw `codex-cli` adapter could not do a stage's work:

- **It wrote nothing and reported success.** Told no sandbox, `codex exec`
  ran read-only: asked to write a file, it said "this workspace is
  read-only" and exited 0.
- **No model.** The registry gave `codex-cli` no `modelFlag`, so a stage's
  `model` was refused, though `codex exec --model` exists.
- **No usage, no events.** Plain text carried only prose: no token counts
  for a budget, no command exit codes, and a failed turn exited 0 too.

## What Changes

- `codex exec --json --sandbox <mode>`: `workspace-write` for `plan`,
  `implement`, `update` and `verify`, `read-only` for every other command;
  the allowlist refuses no sandbox, `danger-full-access` and the bypass
  flag (ADR 0051).
- `--model` from a stage's `model`; `codex-cli` gets `modelFlag` in the
  registry.
- The `--json` stream read: agent messages, commands, a failed command's
  exit code and output tail, changed files as the run's text; the turn's
  usage reported as tokens (cached input apart); a failed turn fails the
  run (`OSW-AGT-222`). `codex-cli` now `reports: "tokens-only"`.
- README, HARNESS.md and LIMITS.md say what was run and measured.

- Effort by model. `codex debug models` lists each model's reasoning
  levels: no listed model takes `minimal`, and every one takes `xhigh` and
  `max`. `codex-cli`'s levels become `low`, `medium`, `high`, `xhigh`,
  `max` (`ultra`, described by codex as automatic task delegation, is not
  offered). Before codex starts, the adapter reads the catalog once a
  process and refuses a model codex does not list (`OSW-AGT-011`) or an
  effort the model does not take (`OSW-AGT-012`), naming what there is; a
  catalog that cannot be read leaves the choice to codex.

Not in this change: Codex over ACP or `codex app-server` - left for a
change of their own.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `acp-agent-adapters`: the raw-adapters requirement no longer holds
  `codex-cli` unchanged; Codex runs in a named sandbox and reports what its
  stream says.

## Impact

- `packages/core`: `agents/codex.ts`, `agents/registry.ts`,
  `default-runners.ts` (allowlist), `harness-step-agent.ts` (reports),
  `message-register.ts` (`OSW-AGT-222`); their tests. `docs/messages.md`.
- ADR 0051. README, HARNESS.md, LIMITS.md.
- A changeset: core minor; extension and server take it with core.
