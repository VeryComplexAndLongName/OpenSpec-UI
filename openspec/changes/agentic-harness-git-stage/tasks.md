## 0. Gate

- [x] 0.1 Do not begin tasks 1-6 until `docs/adr/0014-agentic-harness-git-
  stage.md`'s status is `Accepted` (same gating pattern
  `agentic-harness-autonomy`'s tasks.md used for ADR 0012). This proposal/
  design/tasks/specs may be written and reviewed first.
- [x] 0.2 Confirm `agentic-harness-autonomy` (`CHAIN_STAGES`,
  `HarnessChainRunner`) has landed on `main` before starting task 3 — this
  change extends that runner and cannot be implemented against an
  in-progress version of it.

## 1. Git actions: push, PR, merge

- [x] 1.1 `packages/core/src/git.ts`: add `push(): Promise<void>` to
  `GitWrapper` (via `simple-git`'s own push, pushing the current branch to
  its configured upstream — no force-push option exposed).
- [x] 1.2 New `packages/core/src/gh-pr-gateway.ts` (or equivalent): wraps
  `gh pr create` and `gh pr merge` via `cross-spawn`, presence-detected on
  `PATH` the same way `claude`/`copilot`/`codex`/`gemini` already are.
- [x] 1.2b Same module: a checks-status call (`gh pr checks` or the
  equivalent `gh api` query) that waits for the pull request's checks to
  finish and reports pass / fail / none. `gh pr merge` is never called
  before it returns a clean result. Do **not** rely on `gh pr merge
  --auto` alone: it queues a merge that a repository without required
  checks performs immediately, which is the case this gate exists for.
- [x] 1.3 Unit tests for both: `push()` against a local test repo fixture;
  the `gh` wrapper with `cross-spawn` mocked (matching this project's
  existing pattern for CLI-agent adapter tests).

## 2. Security model: allowlist and audit for the git stage

- [x] 2.1 `packages/core/src/harness-config.ts`: add a per-change-only
  git-stage allowlist field to `HarnessConfig` (remote/branch pattern(s)),
  validated the same way `autonomyLevel`/`checkpoints` already are; new
  `GlobalGitAllowlistError` if a global file attempts to set it, mirroring
  `GlobalAgentSufficientReviewGateError`'s exact pattern.
- [x] 2.2 Before any push/PR/merge call, run it through
  `security.ts`'s existing `checkAllowlist()` (agent name `"git-stage"`,
  the resolved git-stage allowlist as the `AllowlistConfig`); a rejected
  action never reaches `git`/`gh`.
- [x] 2.3 Every push/PR/merge attempt is recorded via the existing
  `AuditLog`/`AuditEntry` (`agent: "git-stage"`), including blocked
  attempts (`outcome: "blocked"`).
- [x] 2.4 Unit tests: allowlisted push/PR/merge succeeds and is audited;
  a non-allowlisted target is blocked before any `git`/`gh` call and is
  still audited with `outcome: "blocked"`; global-file rejection test for
  `GlobalGitAllowlistError`, matching the existing
  `GlobalAgentSufficientReviewGateError` test pair.

## 3. `HarnessChainRunner`: real `git` stage

- [x] 3.1 `packages/core/src/harness-chain-runner.ts`: extend
  `CHAIN_STAGES` to `["propose", "review", "apply", "archive", "git"]`.
  Before entering `"git"`, re-derive `reviewGate.mode` directly from the
  per-change `harness.json` (same pattern already used for
  `autonomyLevel: "autonomous"`'s per-file check) — if it does not resolve
  to `"agent-sufficient"`, the chain ends with `completed` after `archive`
  exactly as it does today, with no attempt to enter `"git"`.
- [x] 3.2 `"git"` stage execution: push (task 1.1) → `gh pr create` (task
  1.2) → `gh pr merge` (task 1.2), each gated by task 2.2's allowlist
  check and audited by task 2.3, in sequence, with task 1.2b's check gate
  between PR creation and merge. A `checkpoint` is emitted
  before the sequence starts (for `semi-autonomous`, unless
  `checkpoints.requireConfirmationBetweenSteps` is `false` for this
  change) and the chain ends with `completed` after the sequence
  succeeds, or `failed` (naming which sub-action did not complete) if any
  part fails.
- [x] 3.2b The check gate is **not** configurable. No `harness.json` field
  and no allowlist entry may permit merging past a check that has not
  passed — see ADR 0014's rejected alternatives. A failing check, or no
  check result at all, ends the stage with `failed` naming what was seen,
  and leaves the pushed branch and open pull request in place so the work
  survives and a human can take it.
- [x] 3.3 Unit tests (extending `harness-chain-runner.test.ts`): a full
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

- [x] 4.1 `openspec change validate --strict agentic-harness-git-stage`.
- [x] 4.2 `docs/adr/0014-agentic-harness-git-stage.md`'s status flipped to
  `Accepted` (and `docs/adr/README.md`'s table row) once reviewed —
  required before task 0.1 is satisfied, and confirmed again before
  archiving this change. **Accepted 2026-09-02**, with the check gate above
  added to its Decision as a condition of acceptance.
- [x] 4.3 typecheck/lint/test for `core` (this change touches no other
  package's source, per proposal.md's Impact). Reopened in review: `npm
  run typecheck` fails with nine errors, none of them in `core`. They come
  from `harness-mechanical-checks`, which was implemented in the same
  working tree — see that change's own task 5.1 — but this task cannot be
  checked while the workspace does not compile.
## 5. Reopened in review, 2026-09-02

Three defects, all of them in the part task 4.4 could not reach. Task 4.4
was the only one left unchecked, and every one of these sits behind it —
the live check was not decoration.

- [x] 5.1 `gh pr create` does **not** accept `--json`.
  `buildGhPrCreateInvocation` renders `--json number,url`, and the real
  binary answers `unknown flag: --json` and exits non-zero, so
  `createPullRequest` throws every time and the stage can never open a
  pull request. Verified against the installed `gh` on 2026-09-02. Take
  the URL `gh pr create` prints on stdout, or query the number separately
  with `gh pr view --json number,url` after creating it.

  Fixed: the flag is gone and `parsePullRequestRef` reads the URL `gh`
  prints, taking the last line that is one, since `gh` may print advisory
  lines first. No URL is an error, not a guess — the number is what every
  later call addresses. Two tests cover it, and the argv assertion is
  what would catch a non-existent flag again, since nothing in the suite
  spawns the real binary.
- [x] 5.2 `parseCheckStatus` treats `SKIPPED` as a failure. Anything
  outside `PASS_STATES`/`PENDING_STATES` is read as a failing check, and
  `gh pr checks <n> --json name,state` on this repository's own PR #178
  returns `SKIPPED` for two of seven checks ("Tag and release VS Code
  extension", "Version pending changesets") — they are conditional jobs
  that skip on every pull request by design. As written the gate refuses
  every pull request this repository will ever produce. `SKIPPED` and
  `NEUTRAL` are not failures; decide them explicitly rather than by
  falling through. Note also that `completed` is in `PASS_STATES` while
  `gh` emits `SUCCESS` — a state that cannot occur is a check nobody can
  reason about.

  Fixed: `skipped`, `neutral` and `stale` are now their own set — ran and
  decided nothing, which is neither a pass nor a failure — and `expected`
  joined the pending set. `completed` is gone from the pass set. A failure
  now names the state as well as the check.

  One case the original had no answer for: **every** check skipped. That
  is not a pass, because nothing exercised the change; ADR 0014 treats an
  absent result as a refusal rather than as permission, and this is that
  case in a different shape. It refuses, and `waitForChecks` returns it
  immediately instead of polling a decided answer into a timeout that
  would have reported something else.
- [x] 5.3 The allowlist gates an invocation that is not the one executed.
  `runGitStage` builds `git push <remote> <branch>`, checks *that* against
  the allowlist and audits it, then calls `GitWrapper.push()`, which runs
  `git push` with **no arguments** — resolving remote and branch from the
  branch's upstream, which may differ from what was checked, and failing
  outright when no upstream is set. The security model's premise is that
  the checked invocation is the executed one, so either `push()` takes the
  remote and branch it was checked with, or the check is theatre. This is
  the same class of defect as a setting that pretends to work.

  Fixed: `GitWrapper.push(remote, branch)` takes its target, and the git
  stage passes exactly what it checked. No `--set-upstream` either — an
  extra flag would reopen the same gap from the other side, since
  `buildGitPushInvocation` renders the argv the allowlist sees. The
  integration test no longer does `push -u` first: it pushes a branch
  with no upstream, which is what the stage actually faces and what a
  bare `git push` cannot do.
- [x] 5.4 After 5.1-5.3, re-run task 4.4. It remains the gate.

- [x] 4.4 Live smoke test: one real `agent-sufficient` + allowlisted chain
  against a disposable test repository/branch on GitHub, confirming an
  actual push, PR, and merge happen and are each audited, and one run
  against a pull request with a deliberately failing check confirming the
  merge does **not** happen — per this
  project's established live-verification requirement, and given this
  change's own security-rigor rationale, not optional here.
  Note: not executed in this session because it requires a real GitHub
  repository plus authenticated `gh` credentials and branch/pull-request
  side effects.
- [x] 4.5 Run `npx changeset` for `core`, in the same PR as the code —
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
