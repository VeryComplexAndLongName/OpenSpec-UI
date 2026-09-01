# ADR 0014: Agentic Harness `git` stage (push / PR / merge)

Status: Proposed

Date: 2026-08-31

## Context

`docs/adr/0011-agentic-harness-config-and-autonomy-levels.md` authorized a
`git` stepAgent role and a `reviewGate.mode: "agent-sufficient"` value
explicitly gating whether it "may execute a commit/push," but did not
implement it — that ADR's own investigation found `GitWrapper.commit()`
unused and no `push()` at all, and named a git action as "new,
security-relevant product functionality" needing "the same rigor
(allowlist/sandbox/audit posture) as the existing CLI-agent orchestration
security model before it ships." `docs/adr/0012-agentic-harness-chain-
execution-protocol.md` then shipped the `propose→review→apply→archive`
chain but deliberately hard-stopped before `git`, "until a follow-up change
gives that action the same allowlist/cwd-sandbox/audit rigor." `HarnessStage`
already reserves `"git"` as a stage value; `reviewGate.mode:
"agent-sufficient"` already validates and resolves per-change — both are
inert today.

This ADR is that follow-up. It is independent of the separate
`docs/adr/0013-acp-agent-adapters.md`: that decision adds a per-*action*
`permissionRequest` mechanism for individual CLI-agent adapters; this one
extends the *existing* per-*stage* `checkpoint`/`autonomyLevel`/
`reviewGate.mode` mechanism to one more stage. Neither depends on the
other.

Investigation before writing this ADR found `packages/core/src/
security.ts` already provides a generic `checkAllowlist(agentName,
invocation, allowlist)` and a generic `AuditLog`/`AuditEntry`, both already
used to gate and log CLI-agent runs and both generic enough (an
executable+args invocation checked against rules, then logged) to reuse
directly for git actions, without a parallel security mechanism.

## Decision

Make the `git` stage real: `HarnessChainRunner`'s `CHAIN_STAGES` gains
`"git"` after `"archive"`, executing push (a new `GitWrapper.push()`), pull
request creation, and merge (via `gh pr create`/`gh pr merge`, this
repository's remote being GitHub) as one sequence, only when the resolved
`reviewGate.mode` is `"agent-sufficient"` (already restricted to a
per-change `harness.json`, never the global file). Every push/PR/merge
action is checked against a new, per-change-only remote/branch allowlist
via the existing `checkAllowlist()`, and audited via the existing
`AuditLog`/`AuditEntry` — both reused as-is, not reimplemented. The
sequence gets one `checkpoint` before it starts (matching every other
stage's granularity) and one `completed`/`failed` after it finishes or
fails, not a pause between each of push/PR/merge individually. A chain
whose resolved `reviewGate.mode` is the default `"human-required"` still
stops cleanly after `archive`, unchanged from today.

## Rejected Alternatives

**A separate, git-specific allowlist/audit mechanism.** Rejected —
`checkAllowlist`/`AuditLog` already generalize over exactly this shape of
problem; a parallel mechanism would duplicate `execution-core`'s existing
rigor for no behavioral benefit.

**Three independently checkpointable sub-stages (push, PR, merge).**
Rejected for this decision — would require either breaking
`stepAgents.git`'s existing key (splitting `"git"` into three
`HarnessStage` values) or a second, finer-grained pause primitive
alongside the existing per-stage one. A single checkpoint for the whole
stage matches how a human currently thinks about delegating "git for this
change" as one decision; finer granularity is a possible future revision,
not adopted here.

**Direct GitHub REST API calls with a stored credential.** Rejected — this
project's CLI-agent orchestration already establishes "never handle API
keys or credentials directly, shell out to a tool that manages its own
login" as a hard invariant (independently reaffirmed by ADR 0013's
rejection of the SDK-based Claude bridge for the same reason); `gh`'s own
`gh auth login` session satisfies the same posture for git-forge actions.

**Support for non-GitHub remotes in this decision.** Rejected as
out-of-scope — this repository's own remote is GitHub, and `gh` is
GitHub-specific; broadening host support has no current motivating use
case and is left to a future decision if one appears.

## Consequences

- `packages/core/src/git.ts` gains `push()`; a new `gh`-based PR/merge
  wrapper is added. No changes to `packages/core/src/agents/` — the `git`
  stage does not invoke a CLI agent.
- `packages/core/src/harness-config.ts` gains a per-change-only git-stage
  allowlist field, validated the same way `autonomyLevel`/`checkpoints`
  already are, with the same global-file rejection pattern.
- `reviewGate.mode: "agent-sufficient"` has an observable effect for the
  first time since ADR 0011 introduced it.
- A change must explicitly opt in via a per-change `harness.json` (both
  `reviewGate.mode: "agent-sufficient"` and a git-stage allowlist) to ever
  reach the `git` stage; every existing configuration and default behavior
  is unchanged.
- Related OpenSpec change: `openspec/changes/agentic-harness-git-stage/`.
