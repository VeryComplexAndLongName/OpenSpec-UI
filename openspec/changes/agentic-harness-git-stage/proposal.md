## Why

`docs/adr/0011-agentic-harness-config-and-autonomy-levels.md` authorized a
`git` stepAgent role and a `reviewGate.mode: "agent-sufficient"` config value
explicitly gating whether it "may execute a commit/push," but did not
implement it: that ADR's own investigation found `packages/core/src/git.ts`'s
`GitWrapper.commit()` unused by any feature and no `push()` at all, and
named a `git` action as "new, security-relevant product functionality" that
needs "the same rigor (allowlist/sandbox/audit posture) as the existing
CLI-agent orchestration security model before it ships." `docs/adr/
0012-agentic-harness-chain-execution-protocol.md` then built the
`propose→review→apply→archive` chain runner but deliberately hard-stopped
before `git` "until a follow-up change gives that action the same
allowlist/cwd-sandbox/audit rigor." `HarnessStage`
(`packages/core/src/harness-stage.ts`) already reserves `"git"` as a stage
value, and `reviewGate.mode: "agent-sufficient"` already validates and
resolves per-change — both are inert today, waiting on exactly this change.

This proposal is that follow-up: it makes the `git` stage real (push, open a
pull request, merge), reusing the chain/checkpoint/autonomy mechanism
`agentic-harness-autonomy` already shipped rather than inventing a new one.

**Scope note**: this is independent of the separate `acp-agent-adapters`
change / `docs/adr/0013-acp-agent-adapters.md`. That change adds a
per-*action* `permissionRequest` mechanism for individual CLI-agent
adapters; this change extends the *existing* per-*stage*
`checkpoint`/`autonomyLevel`/`reviewGate.mode` mechanism to one more stage.
Neither depends on the other.

## What Changes

- `packages/core/src/git.ts`'s `GitWrapper` gains `push()`, and a new
  `PullRequestGateway` (or equivalent) wraps `gh pr create`/`gh pr merge`
  (this repository's own remote is GitHub; `gh` is presence-detected on
  `PATH` the same way every CLI-agent tool already is — never bundled,
  never handling credentials directly, matching this project's existing
  posture for external tools).
- New git-action security model, scoped to this one stage: an explicit
  remote/branch allowlist (the harness config's per-change `harness.json`
  only — never resolvable from the global file, mirroring
  `autonomyLevel: "autonomous"`'s and `checkpoints.
  requireConfirmationBetweenSteps: false`'s existing per-change-only
  restriction), and an audit log entry for every push/PR/merge attempt,
  successful or not — matching the rigor `execution-core` already requires
  for CLI-agent runs, applied here to a different kind of action.
- `packages/core/src/harness-chain-runner.ts`'s `CHAIN_STAGES` gains
  `"git"` after `"archive"`. The `git` stage only executes when the
  resolved `reviewGate.mode` is `"agent-sufficient"` (already per-change-
  only); otherwise the chain still stops cleanly after `archive`, exactly
  as it does today — this is not a behavior change for any change that
  has not explicitly opted in.
- The `git` stage runs push → open PR → merge as one sequence with a
  single `checkpoint` before it starts (for `semi-autonomous`) and one
  `stageCompleted`/`completed` after it finishes — the same per-*stage*
  granularity every other stage already has, not three separate
  checkpoints (see design.md's Decisions for the rejected finer-grained
  alternative and why it is deferred, not adopted, in this change).
- The merge waits for the pull request's checks and refuses a pull request
  whose checks have not passed — not a configuration option, a property of
  the stage. Added when ADR 0014 was accepted (2026-09-02): the sequence as
  first written was push, `gh pr create`, `gh pr merge`, and `gh pr merge`
  without `--auto` merges immediately, whether or not anything has run. A
  stage whose entire purpose is acting with no human present would
  otherwise merge a red pull request into `main` under `agent-sufficient`,
  removing the one gate that has actually held for this project.
- `openspec/specs/agentic-harness/spec.md`: new requirements for the git
  stage's execution, its check gate, its allowlist/audit rigor, and
  `reviewGate.mode: "agent-sufficient"` actually gating something for the
  first time.

## Capabilities

### New Capabilities

(none — this extends the existing `agentic-harness` capability)

### Modified Capabilities

- `agentic-harness`: the `git` stage becomes real (push/PR/merge);
  `reviewGate.mode: "agent-sufficient"` becomes functional; new
  remote/branch allowlist and audit requirements scoped to this stage.

## Impact

- `packages/core/src/git.ts`: new `push()`; new PR/merge wrapper module.
- `packages/core/src/harness-chain-runner.ts`: `CHAIN_STAGES` extended;
  new stage-execution branch for `"git"`.
- `packages/core/src/harness-config.ts`: new per-change-only allowlist
  field(s) on `HarnessConfig`, validated the same way
  `autonomyLevel`/`checkpoints` already are.
- `packages/core/src/security.ts` (the existing CLI-agent audit log):
  a git-action entry shape, reusing the existing log rather than a
  parallel one, if the existing shape accommodates it — see design.md.
- `docs/adr/0014-agentic-harness-git-stage.md` (new, Status: Proposed —
  this change's implementation should not begin until this ADR is
  Accepted, mirroring `agentic-harness-autonomy`'s own gate on ADR 0012).
- No change to `packages/core/src/agents/` (no `AgentRunner`/adapter is
  invoked for the `git` stage — it is direct `git`/`gh` invocation, not a
  CLI-agent run), and no change to `acp-agent-adapters`'s protocol
  members.
