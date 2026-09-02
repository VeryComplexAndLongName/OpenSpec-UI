## 0. Gate

- [x] 0.1 Do not begin tasks 1-6 until `docs/adr/0014-agentic-harness-git-
  stage.md`'s status is `Accepted` (same gating pattern
  `agentic-harness-autonomy`'s tasks.md used for ADR 0012). This proposal/
  design/tasks/specs may be written and reviewed first.
- [ ] 0.2 Confirm `agentic-harness-autonomy` (`CHAIN_STAGES`,
  `HarnessChainRunner`) has landed on `main` before starting task 3 — this
  change extends that runner and cannot be implemented against an
  in-progress version of it.

## 1. Git actions: push, PR, merge

- [ ] 1.1 `packages/core/src/git.ts`: add `push(): Promise<void>` to
  `GitWrapper` (via `simple-git`'s own push, pushing the current branch to
  its configured upstream — no force-push option exposed).
- [ ] 1.2 New `packages/core/src/gh-pr-gateway.ts` (or equivalent): wraps
  `gh pr create` and `gh pr merge` via `cross-spawn`, presence-detected on
  `PATH` the same way `claude`/`copilot`/`codex`/`gemini` already are.
- [ ] 1.2b Same module: a checks-status call (`gh pr checks` or the
  equivalent `gh api` query) that waits for the pull request's checks to
  finish and reports pass / fail / none. `gh pr merge` is never called
  before it returns a clean result. Do **not** rely on `gh pr merge
  --auto` alone: it queues a merge that a repository without required
  checks performs immediately, which is the case this gate exists for.
- [ ] 1.3 Unit tests for both: `push()` against a local test repo fixture;
  the `gh` wrapper with `cross-spawn` mocked (matching this project's
  existing pattern for CLI-agent adapter tests).

## 2. Security model: allowlist and audit for the git stage

- [ ] 2.1 `packages/core/src/harness-config.ts`: add a per-change-only
  git-stage allowlist field to `HarnessConfig` (remote/branch pattern(s)),
  validated the same way `autonomyLevel`/`checkpoints` already are; new
  `GlobalGitAllowlistError` if a global file attempts to set it, mirroring
  `GlobalAgentSufficientReviewGateError`'s exact pattern.
- [ ] 2.2 Before any push/PR/merge call, run it through
  `security.ts`'s existing `checkAllowlist()` (agent name `"git-stage"`,
  the resolved git-stage allowlist as the `AllowlistConfig`); a rejected
  action never reaches `git`/`gh`.
- [ ] 2.3 Every push/PR/merge attempt is recorded via the existing
  `AuditLog`/`AuditEntry` (`agent: "git-stage"`), including blocked
  attempts (`outcome: "blocked"`).
- [ ] 2.4 Unit tests: allowlisted push/PR/merge succeeds and is audited;
  a non-allowlisted target is blocked before any `git`/`gh` call and is
  still audited with `outcome: "blocked"`; global-file rejection test for
  `GlobalGitAllowlistError`, matching the existing
  `GlobalAgentSufficientReviewGateError` test pair.

## 3. `HarnessChainRunner`: real `git` stage

- [ ] 3.1 `packages/core/src/harness-chain-runner.ts`: extend
  `CHAIN_STAGES` to `["propose", "review", "apply", "archive", "git"]`.
  Before entering `"git"`, re-derive `reviewGate.mode` directly from the
  per-change `harness.json` (same pattern already used for
  `autonomyLevel: "autonomous"`'s per-file check) — if it does not resolve
  to `"agent-sufficient"`, the chain ends with `completed` after `archive`
  exactly as it does today, with no attempt to enter `"git"`.
- [ ] 3.2 `"git"` stage execution: push (task 1.1) → `gh pr create` (task
  1.2) → `gh pr merge` (task 1.2), each gated by task 2.2's allowlist
  check and audited by task 2.3, in sequence, with task 1.2b's check gate
  between PR creation and merge. A `checkpoint` is emitted
  before the sequence starts (for `semi-autonomous`, unless
  `checkpoints.requireConfirmationBetweenSteps` is `false` for this
  change) and the chain ends with `completed` after the sequence
  succeeds, or `failed` (naming which sub-action did not complete) if any
  part fails.
- [ ] 3.2b The check gate is **not** configurable. No `harness.json` field
  and no allowlist entry may permit merging past a check that has not
  passed — see ADR 0014's rejected alternatives. A failing check, or no
  check result at all, ends the stage with `failed` naming what was seen,
  and leaves the pushed branch and open pull request in place so the work
  survives and a human can take it.
- [ ] 3.3 Unit tests (extending `harness-chain-runner.test.ts`): a full
  `agent-sufficient` + allowlisted chain reaches and completes the `git`
  stage; a `human-required` chain still stops after `archive` (regression
  test — must not change existing behavior); a non-allowlisted git-stage
  config fails the `git` stage without attempting any git/gh call; a
  mid-sequence failure (e.g. push succeeds, `gh pr create` fails) ends
  with `failed` naming the PR-creation step specifically; a pull request
  whose checks fail is **not** merged and ends the stage with `failed`
  naming the failing check; a pull request reporting no checks at all is
  likewise not merged.

## 4. Spec, ADR status, and verification

- [ ] 4.1 `openspec change validate --strict agentic-harness-git-stage`.
- [x] 4.2 `docs/adr/0014-agentic-harness-git-stage.md`'s status flipped to
  `Accepted` (and `docs/adr/README.md`'s table row) once reviewed —
  required before task 0.1 is satisfied, and confirmed again before
  archiving this change. **Accepted 2026-09-02**, with the check gate above
  added to its Decision as a condition of acceptance.
- [ ] 4.3 typecheck/lint/test for `core` (this change touches no other
  package's source, per proposal.md's Impact).
- [ ] 4.4 Live smoke test: one real `agent-sufficient` + allowlisted chain
  against a disposable test repository/branch on GitHub, confirming an
  actual push, PR, and merge happen and are each audited, and one run
  against a pull request with a deliberately failing check confirming the
  merge does **not** happen — per this
  project's established live-verification requirement, and given this
  change's own security-rigor rationale, not optional here.
- [ ] 4.5 Run `npx changeset` for `core`, in the same PR as the code —
  this creates a changeset *proposal* file only; it does not itself bump
  `package.json`'s version (see `.changeset/README.md` — applying pending
  changesets via `npx changeset version` is a separate, later step, not
  part of this task).

## Explicitly out of scope for this change (tracked for follow-up, not tasks here)

- Per-action checkpoints within the `git` stage (push vs. PR vs. merge as
  independently pausable steps).
- Non-GitHub remotes (GitLab, Gitea, etc.).
- Any change to `acp-agent-adapters`'s protocol members or to any
  `AgentRunner`/CLI-agent adapter.
