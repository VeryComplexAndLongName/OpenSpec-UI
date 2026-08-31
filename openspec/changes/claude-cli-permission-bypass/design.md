## Context

`claude --help` (installed CLI, this session, `claude` = Claude Code):
`--dangerously-skip-permissions` ("Bypass all permission checks.
Recommended only for sandboxes with no internet access.") and
`--permission-mode <mode>` (`acceptEdits`, `auto`, `bypassPermissions`,
`manual`, `dontAsk`, `plan`) are the two available non-interactive
permission controls. `default-runners.ts`'s existing allowlist already
shows this project's established stance for the other adapters:
`gemini-cli` uses `--yolo` (gemini's own equivalent full-bypass flag);
`copilot-cli` uses `--allow-all-tools`. `claude-cli` is the only one of
the four CLI adapters with no such flag today.

## Goals / Non-Goals

**Goals:**

- A `claude-cli` `plan`/`review`/`implement` run can actually use the
  `Edit`/`Write`/`Bash` tools it needs in a real, non-interactive
  invocation, instead of stalling on an unanswerable approval prompt.
- Stay consistent with this project's already-established posture for
  the other three CLI adapters (full non-interactive bypass), not
  introduce a fourth, differently-scoped permission model.

**Non-Goals (this change):**

- The separate, still-open, `docs/adr/0012` terminal-event-contract gap
  this incident also exposed — a blocked/no-op run reporting `completed`
  instead of a state that makes the failure obvious. Already flagged as
  out of scope once, in the (retracted) `copilot-cli-path-permission`
  investigation; still real, still not fixed here, still worth its own
  change.
- Per-tool granularity (e.g. allow `Edit` but not `Bash`, or scope to
  specific paths). See Decisions below for why.

## Decisions

### `--dangerously-skip-permissions`, not `--permission-mode acceptEdits`

Chosen: the broad bypass flag, matching `gemini-cli`'s existing `--yolo`
precedent in this same file.

**Rejected alternative**: `--permission-mode acceptEdits`. Rejected —
its name and the mode list (`acceptEdits` distinct from `bypassPermissions`)
imply it auto-accepts file edits specifically but does not necessarily
extend to `Bash` tool calls, which this repository's own `tasks.md`
convention routinely asks an implementing agent to run (typecheck/lint/
test commands, `git` inspection, etc. — see e.g. this very change's own
task 3.2 below). Picking a mode that fixes `Edit` but leaves `Bash`
unapproved would very likely just move today's exact failure (a stalled,
unanswerable approval prompt reported as a false `completed`) from one
tool to the next the first time a task needs to run a shell command,
rather than actually closing the gap this incident demonstrated.

**Not reconsidered**: whether this project's own security boundary
(`checkCwdSandbox` + the allowlist + `AuditLog` in `security.ts`) is
sufficient without also relying on each CLI's own internal prompt-based
permission system as a second line of defense — already decided, for the
identical reasoning, in `copilot-cli-path-permission/design.md`'s Risks
section (not re-litigated here): this project already does not treat a
CLI's own interactive approval prompts as part of its security model:
`gemini-cli` already runs fully unattended via `--yolo`. `claude-cli`
having a narrower default was never a deliberate choice recorded
anywhere — it was simply the one adapter nobody had added the
equivalent flag to yet.

## Risks / Trade-offs

- **[Trade-off]** `--dangerously-skip-permissions` is broad — no
  per-tool or per-path granularity, matching `--yolo`'s existing
  breadth for `gemini-cli`. Accepted for the same reason already
  accepted there: this project's actual security boundary is
  `checkCwdSandbox`/the allowlist/`AuditLog`, not any individual CLI's
  own interactive prompts.
- **[Risk]** None identified around the allowlist: `default-runners.ts`
  is updated in the same commit, so `checkAllowlist` never falls out of
  sync with what `claude.ts` actually spawns (same reasoning as
  `copilot-cli-path-permission`'s "update the allowlist in the same
  commit" decision).

## Migration Plan

No migration. Purely additive argv flag plus the matching allowlist
update; no persisted state, no protocol change.
