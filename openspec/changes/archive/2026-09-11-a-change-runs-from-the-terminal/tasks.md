Three CLI commands and every one of them reads. The harness runs only
where a person is watching, and two things this repository already built
— a scheduled run, and the worktree parallelism coming next — need a way
to start a chain without an editor open.

## 1. The decision

- [x] 1.1 `docs/adr/0020-cli-runs-a-change.md`: the CLI gains a way to
  run a change. It supersedes ADR 0007 decision 2 and ADR 0009 decision 4
  — the "validate only" scope, which `change-graph` (#250) and
  `release-manifest` (#218) already overtook without one. Replace the
  list with a rule: the CLI may expose a capability core already owns
  where it needs no human-in-the-loop UI to be used correctly, and may
  never expose one the interactive hosts do not have.
- [x] 1.2 Record the safety argument as its own decision, because it is
  what makes a second entry point into the harness acceptable: the CLI
  runs what the resolved configuration permits and offers no flag that
  permits more.
- [x] 1.3 `docs/adr/README.md` gains the row. ADR 0007 and ADR 0009 gain
  a line each pointing at it, so a reader arriving at the superseded
  decision is told where it went.

## 2. The lease knows a third kind of host

- [x] 2.1 `packages/core/src/workspace-lease.ts`:
  `WorkspaceLeaseHostKind` gains `"cli"`.
- [x] 2.2 `hostKindLabel` becomes exhaustive rather than a ternary. Today
  a third kind would be reported to a user as "standalone server", which
  is the kind of wrong that survives for months because it reads as
  plausible.
- [x] 2.3 A core helper that holds the lease for the duration of one
  async operation: acquire, renew on the existing interval, release on
  exit including on throw. `WorkbenchProcessScheduler` keeps its inline
  version — it releases and re-acquires across suspension and resume,
  which a scope-bound helper cannot express. Say that in the comment, so
  the next reader does not "unify" two things that differ.

## 3. Refusing before anything is spent

- [x] 3.1 A core function that answers, for one change, whether a chain
  can be started here and what stops it: the change exists, the name is
  valid, the configuration parses, the autonomy level has a chain,
  checkpoints can be answered given whether a person is present, and
  every stage's agent resolves to a runner this build has. Core, not the
  CLI — a host wanting the same answer before revealing a panel should
  read it from one place.
- [x] 3.2 Each refusal carries the configuration key that governs it, not
  only a sentence. The caller renders the sentence; the key is what makes
  it actionable.
- [x] 3.3 The unavailable-agent check covers every stage, including ones
  the chain may never reach. A chain that fails at `apply` has already
  paid for `propose` and `review`.
- [x] 3.4 Tests: one per refusal, each asserting that no runner was
  invoked.

## 4. `run`

- [x] 4.1 `openspec-ui-cli run <change>` in `packages/cli/src/main.ts`,
  with `--cwd` as the existing commands have it. Usage text and the
  exit-code section updated.
- [x] 4.2 Wiring that mirrors `packages/server/src/cli.ts` exactly: one
  `FileAuditLog` at `auditLogPath(workspaceRoot)`, shared between
  `buildDefaultAgentRunners` and the chain runner's `listAuditEntries`,
  so a terminal run is audited and counted where every other run is.
- [x] 4.3 Dispatch through `resolveRunWithHarnessTarget` and
  `HarnessChainRunner`, not a second copy of the decision.
- [x] 4.4 Exit `0` completed, `1` failed or cancelled, `2` refused or
  unable to start. Every non-zero case prints its reason.
- [x] 4.5 `SIGINT` cancels the chain, which terminates the spawned
  process tree; a second `SIGINT` exits at once. Without this, Ctrl-C
  leaves an agent CLI parented to nothing and a lease with no holder.

## 5. Checkpoints

- [x] 5.1 Where the configuration asks for a confirmation and input is a
  terminal, put the Continue/Cancel choice on standard input and wait.
- [x] 5.2 Where input is not a terminal, refuse the whole run in section
  3's resolution, before the first stage. Refusing at the first
  checkpoint instead would leave a change whose proposal a dead chain had
  already rewritten.
- [x] 5.3 The refusal names `checkpoints.requireConfirmationBetweenSteps`
  and says that setting it to `false` in the change's own `harness.json`
  is what makes this change runnable unattended.

## 6. Reading the output

- [x] 6.1 Default `--format text`: stage boundaries, the agent each stage
  used, output as it arrives, and a closing summary. Unlike `validate`,
  which defaults to JSON because its output is one document made at the
  end.
- [x] 6.2 Streamed agent text is joined by the same rule the panel uses
  (`readAcpStreamedText`), so an ACP agent's reply is prose in a terminal
  too rather than one slice per line.
- [x] 6.3 `--format json`: one JSON object per line, each the published
  event verbatim. Not an array — an array cannot be written until the run
  ends, and a CI log that is empty for nine minutes and then complete is
  the failure this format exists to avoid.
- [x] 6.4 Both formats write as the run produces output. Assert it:
  a test that reads a line before the run has finished.

## 7. `check`

- [x] 7.1 `openspec-ui-cli check <change>`: run the mechanical checks the
  change's `tasks.md` declares, through `runMechanicalCheck`, and report
  each name and reason.
- [x] 7.2 No agent is resolved and nothing is spent. The check names come
  from the change; the CLI accepts no check name on its command line and
  adds nothing to the registry.
- [x] 7.3 A change declaring no checks reports that and exits `0`. Most
  changes in this repository's history declared none; calling that a
  failure would be a false report.
- [x] 7.4 Exit `1` where a check failed, with every check's outcome still
  reported — the same shape `validate` already uses for a partial
  failure.

## 8. Tests

- [x] 8.1 Core: the lease's third host kind, and every label.
- [x] 8.2 Core: the scope-bound lease helper releases on success, on
  throw, and does not release a lease reclaimed away from it.
- [x] 8.3 Core: each refusal from section 3, and that a permitted change
  produces no refusal.
- [x] 8.4 CLI: `run` exits 0/1/2 for the three outcomes, against a fake
  chain runner — the existing `MainDeps` injection shape, so no agent is
  spawned in a unit test.
- [x] 8.5 CLI: a checkpoint with a terminal present is answered from
  input; without one, the run never started.
- [x] 8.6 CLI: `--format json` output is one parseable object per line,
  and arrives before the run ends.
- [x] 8.7 CLI: `check` reports each declared check, exits 1 on a failure
  and 0 on a change declaring none.
- [x] 8.8 A core test asserted that no real `tasks.md` in this
  repository declares a check. This change declares the first two, so
  that assertion is now false. It was a statement about the repository's
  contents on the day it was written, not an invariant — replaced with
  an independent count of lines that end in a declaration, which still
  fails if prose describing the syntax starts parsing as one.
  `packages/core/src/task-checklist.test.ts`.

  Found while doing it, and left recorded rather than fixed here:
  `scripts/check-test-budgets.mjs` scans a test call's arguments by
  balancing brackets and skipping strings, and treats a backtick inside
  a **regex literal** as the start of a template string. The scan then
  runs past the call and the file's stated time budget stops being
  found, so a file with a budget is reported as having none. Worked
  around above by spelling the same check with string methods. The
  checker's own fix is its own change — it is the same class of bug its
  header already records once (`emit(` matching as `it(`).
- [x] 8.9 Budget item: these land in `packages/cli`, whose test budget is
  checked by `scripts/check-test-budgets.mjs`. Raise the budget in the
  same change if it binds, rather than trimming coverage to fit it.

## 9. Verification

- [x] 9.1 This change validates strictly. `check(validate-change)`
  Run 2026-09-11 through `openspec-ui-cli check`, which is this change's
  own new command: `OK validate-change — openspec change validate
  --strict a-change-runs-from-the-terminal: 1 item(s) passed`.
- [x] 9.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts. Run
  2026-09-11, exit 0 — typecheck, lint (english, source-text,
  changesets, test-budgets, per-package eslint) and test all green.
  Counts: scripts under `node --test` — english 4, test-budgets 10,
  changesets 9; `@openspec-ui/cli` 84 tests in 7 files (48 before this
  change); `@openspec-ui/core` 985 in 70 files (963 before);
  `openspec-ui-vscode` 322 in 24; `@openspec-ui/server` 80 in 4;
  `@openspec-ui/webui` 374 in 41.
- [x] 9.3 Whole browser suite, not only the specs this touches. Run
  2026-09-11, exit 0: 14 passed in 3.6m, one worker, every spec —
  change-charts, harness-screenshots, lifecycle-concurrent-hosts,
  lifecycle-execution (3), lifecycle-recovery-and-rollback,
  scheduled-run (2), standalone, waiting-on-inbox (4). Nothing here
  touches the browser; run because a selective run once reported green
  while a change broke a spec it never mentioned.
- [x] 9.4 A pending changeset exists. `check(changeset-present)`
  The check counts pending files and cannot tell whose they are — two
  were already pending from earlier changes when this was written. The
  part it cannot check: one of them versions `core` and `cli` for this
  change.
- [ ] 9.5 **Delegated to `claude-cli`**: run a real change from a real
  terminal, end to end, in a throwaway workspace — not this repository.
  Evidence to record here: the command, the change's `harness.json`, the
  stages that ran, the exit code, and the audit log lines the run wrote.
  Unit tests cover the dispatch and the exit codes against a fake runner;
  only a real run shows whether the wiring spends, records and releases
  the way the two hosts do.
- [ ] 9.6 **Delegated to `claude-cli`**: the two refusals that cost
  nothing, live — an `assisted` change, and a `semi-autonomous` one with
  its input not a terminal. Evidence: the command, the message, the exit
  code, and the audit log showing no entry was written for either.
