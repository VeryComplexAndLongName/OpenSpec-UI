## Context

See `proposal.md` for motivation. Load-bearing facts gathered before writing
this design:

- `packages/core/src/git.ts`'s `GitWrapper` (built on `simple-git`) already
  has `status()`/`diff()`/`commit()`/`currentBranch()`; no `push()` exists.
- `packages/core/src/harness-stage.ts`'s `HarnessStage` already includes
  `"git"`; `packages/core/src/harness-chain-runner.ts`'s `CHAIN_STAGES`
  explicitly excludes it (`["propose", "review", "apply", "archive"]`,
  with a comment noting the chain "never invokes the `git` stepAgent under
  any configuration").
- `packages/core/src/harness-config.ts` already validates and resolves
  `reviewGate.mode: "human-required" | "agent-sufficient"`, restricted to
  per-change files for `"agent-sufficient"` — this exists today but gates
  nothing, since no git action exists yet to gate.
- `packages/core/src/security.ts` already provides a generic
  `checkAllowlist(agentName, invocation, allowlist)` (keyed by an
  arbitrary name, checking an `AdapterInvocation`-shaped executable+args
  against `AllowlistRule[]`) and a generic `AuditLog`/`AuditEntry`
  (`runId`, `agent`, `outcome`, `cwd`, `timestamp`, optional `invocation`/
  `reason`/`summary`) — both already used for CLI-agent runs, both
  generic enough to reuse directly for git-stage actions without a
  parallel security mechanism.
- This repository's own remote is GitHub (`git remote -v`); `gh` is a
  reasonable, already-conventional choice for pull-request creation/merge
  that keeps this project's existing "shell out to an already-
  authenticated external CLI, never handle credentials directly" posture.

## Goals / Non-Goals

**Goals:**

- Make the `git` stage (push, open a pull request, merge) real, reusing
  `agentic-harness-autonomy`'s existing chain/checkpoint/autonomy-level
  mechanism rather than inventing a new one.
- Make `reviewGate.mode: "agent-sufficient"` have an actual, observable
  effect for the first time.
- Give the git stage its own remote/branch allowlist and audit trail, at
  the same rigor `execution-core` already requires for CLI-agent runs, by
  reusing `security.ts`'s existing mechanisms rather than parallel ones.
- Preserve today's default behavior exactly: a chain with the default
  `reviewGate.mode: "human-required"` still stops cleanly after `archive`.

**Non-Goals (this change):**

- Any change to `acp-agent-adapters`'s protocol members
  (`agentUpdate`/`permissionRequest`/`resolvePermission`) or to any
  `AgentRunner`/CLI-agent adapter — the git stage does not invoke a CLI
  agent at all, it invokes `git`/`gh` directly.
- Per-action checkpoints within the git stage (a pause between push and PR
  creation, or between PR creation and merge). This change gives the
  whole `git` stage one checkpoint, matching every other stage's
  granularity — see Decisions for the rejected finer-grained alternative.
- Support for git hosts other than GitHub (GitLab, Gitea, etc.) — `gh` is
  GitHub-specific; a future change can generalize this if this project
  ever needs to target a non-GitHub remote.
- Conflict resolution, force-push, or any git operation beyond a
  fast-forward-safe push of the change's own branch, PR creation, and
  merge of that same PR.
- Parallel task execution / worktree isolation — unrelated, still deferred
  per ADR 0011.

## Decisions

### The merge waits for checks, and that is not configurable

`gh pr merge` without `--auto` merges as soon as it is called. The stage
instead waits for the pull request's checks to finish and merges only on
a clean result; a failing check, or no check result at all, ends the stage
with `failed` and leaves the branch pushed and the pull request open, so
nothing is lost and a human can pick it up.

**Rejected alternative**: merge immediately and let branch protection
refuse it if the repository has any. Rejected — that makes correctness
depend on a setting outside this repository's own source, invisible from
here and silently absent on any fork or new workspace. The stage would
work correctly in one configuration and merge red elsewhere, with no
difference visible in the code.

**Rejected alternative**: treat "no checks configured" as permission to
merge. Rejected — a chain running unattended has no other evidence that
the change is sound, so an absent result is the case where merging is
least justified, not most.

**Rejected alternative**: make the wait configurable per change. Rejected
— it would be turned off exactly when someone is in a hurry, which is when
it is least safe. See ADR 0014's rejected alternatives.

### Reuse `security.ts`'s existing allowlist/audit mechanisms, not a parallel model

The git stage's push/PR-create/merge actions are each checked via the
existing `checkAllowlist()` (treating `"git"` and `gh` as allowlist-checked
executables, the harness's own per-change config as the `AllowlistConfig`
source) and logged via the existing `AuditLog`/`AuditEntry`, with `agent`
set to a fixed sentinel (e.g. `"git-stage"`) so these entries are
distinguishable from CLI-agent run entries in the same log.

**Rejected alternative**: build a separate, git-specific
allowlist/audit mechanism. Rejected — `checkAllowlist`/`AuditLog` are
already generic over "an executable+args invocation, checked against
rules, then audited," which is exactly what a git push or a `gh pr
create`/`gh pr merge` call is; a parallel mechanism would duplicate logic
`execution-core` already has for no behavioral benefit, and would need its
own review against the same rigor bar this change is trying to meet by
reusing the existing one.

### One checkpoint for the whole `git` stage, not one per push/PR/merge

`semi-autonomous` pauses once before the `git` stage starts (as it already
does before every other stage) and once more only if the entire
push→PR→merge sequence completes or fails — not between the three
sub-actions.

**Rejected alternative**: extend `HarnessStage`/the `checkpoint` protocol
to expose push/PR/merge as three independently checkpointable
sub-stages. Rejected for this change — it would mean either splitting
`"git"` into three new `HarnessStage` values (a breaking change to any
already-configured `stepAgents.git` entry, since that key would no longer
exist) or inventing a new, finer-grained pause primitive alongside the
existing per-stage one (two parallel granularities to reason about for
one feature). The single-checkpoint design matches how a human currently
thinks about "let the harness handle git for this change" as one
decision, and keeps this change's protocol footprint at zero — it can be
revisited as its own follow-up if per-action granularity within the git
stage turns out to matter in practice.

### `gh` CLI for pull-request creation and merge; `simple-git`'s new `push()` for the push itself

Push reuses the existing `GitWrapper` (`simple-git`); PR creation/merge
shells out to `gh pr create`/`gh pr merge`, presence-detected on `PATH`
exactly like `claude`/`copilot`/`codex`/`gemini` already are — never
bundled, never given credentials directly (the user's own `gh auth login`
session is used, matching this project's existing "shell out to a tool
that manages its own login" posture for every other external tool).

**Rejected alternative**: call GitHub's REST API directly (via a token
this product would need to store/manage). Rejected — it would require
this project to hold and manage a credential for the first time, directly
contradicting the "never handles API keys or credentials directly"
posture already established for CLI-agent orchestration and just
reaffirmed by `acp-agent-adapters`'s rejection of the SDK-based Claude
bridge for the same reason.

## Risks / Trade-offs

- **[Risk]** A push/PR/merge sequence that fails partway (for example,
  push succeeds but PR creation fails) leaves the branch pushed without an
  open PR. → **Mitigation**: each sub-action is individually audited (see
  the "Every git-stage action is audited" requirement), and the stage ends
  with `failed` naming exactly which sub-action did not complete — the
  branch itself is never force-pushed or rolled back, so the failure is
  visible and recoverable by a human exactly where it stopped.
- **[Risk]** `gh` may not be installed/authenticated on a given machine.
  → **Mitigation**: presence-detected the same way as every other external
  tool this project shells out to; a run attempted without it ends in
  `failed` naming the missing binary, per the existing pattern for a
  missing CLI-agent tool.
- **[Trade-off]** GitHub-only (via `gh`) is a real scope limitation, not an
  oversight — accepted because this repository's own remote is GitHub and
  broader host support has no current motivating use case.
- **[Trade-off]** One checkpoint per whole `git` stage (not per sub-action)
  means `semi-autonomous` cannot pause between "pushed" and "PR opened,"
  for example — accepted as matching every other stage's granularity; see
  Decisions for the rejected finer-grained alternative.

## Migration Plan

No data migration. `CHAIN_STAGES` gaining `"git"` is additive to the chain
runner's own sequence; behavior for any change whose resolved
`reviewGate.mode` remains the default `"human-required"` is unchanged — the
chain still stops after `archive`. Only a change with an explicit
per-change `harness.json` setting `reviewGate.mode: "agent-sufficient"`
*and* a git-stage allowlist newly reaches the `git` stage at all.

## Open Questions

None — the granularity and host-support decisions above are resolved
(and, where deferred, explicitly marked as future follow-ups) rather than
left open.
