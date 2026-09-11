`blocked_by` means a change cannot start until another lands. It is
computed, reported, and read by nothing that starts a run — so a change
that says of itself "do not start me yet" starts.

## 1. The gate

- [x] 1.1 `chain-preflight.ts` refuses a chain whose change has an unmet
  blocker, naming it. Reuses `findUnmetBlockers` rather than restating
  its rule: a blocker is unmet when it is still an active change.
- [x] 1.2 The refusal names the blocker and not a configuration key.
  Every other refusal here points at a setting because that is the
  remedy; this one's remedy is to land that change or delete the line.
- [x] 1.3 A blocker naming a change that does not exist does not hold
  anything — `checkChangeGraph` reports that as the relation fault it
  is, and holding the run on it would hide a fault behind something
  that reads as a schedule.
- [x] 1.4 Placed after the checkpoint check and before the declared
  steps and the stage agents. It is not the cheapest check — it builds
  the graph — and the comment must say why it sits there anyway: a run
  refused for a blocker should say so, not report a detail of a run
  that was never going to start.

## 2. What does not change

- [x] 2.1 `checkChangeGraph` still does not fail on an unmet blocker. A
  change declaring one is valid; it states a plan. Assert it, because
  the two gates are one word apart in conversation and a future reader
  will try to "fix" the inconsistency.
- [x] 2.2 No option starts a blocked change anyway. The declaration is
  in a file under version control, and an override would move the
  decision into an invocation nobody reviews (ADR 0020 decision 3).

## 3. Tests

- [x] 3.1 Core: a chain for a change with an active blocker is refused,
  naming it, with no runner invoked.
- [x] 3.2 Core: the same change starts once the blocker is archived.
- [x] 3.3 Core: a blocker naming a change that does not exist does not
  refuse the run.
- [x] 3.4 Core: several unmet blockers are all named, not just the
  first — a reader who lands one and is refused again for the next has
  been told half the truth.
- [x] 3.5 Core: `checkChangeGraph` still reports no violation for the
  blocked change, so the run gate and the validation gate stay
  distinct.

## 4. Verification

- [x] 4.1 This change validates strictly. `check(validate-change)`
- [x] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts. Run
  2026-09-11, exit 0 — typecheck, lint and test all green. Counts:
  `@openspec-ui/cli` 97 in 9 files; `@openspec-ui/core` 1068 in 77
  files (1063 before this change); `openspec-ui-vscode` 327 in 24;
  `@openspec-ui/server` 80 in 4; `@openspec-ui/webui` 379 in 41.
- [x] 4.3 A pending changeset exists. `check(changeset-present)`
- [x] 4.4 **Delegated to `claude-cli`**: from a real terminal, try to
  run a change declaring an unmet blocker and record the refusal and the
  exit code; then archive the blocker and run the same command again.
  Evidence: both commands, both outputs, and the audit log showing
  nothing was written for the refused one. The unit tests drive the
  resolution directly; only a real run shows that the refusal reaches
  the terminal before anything is spent.

  Run 2026-09-11 in a throwaway repository holding `groundwork` and
  `dependent`, the second declaring `blocked_by: [groundwork]` and
  configured to run unattended.

  **Refused**, before any stage:

      openspec-ui-cli run dependent --cwd <repo>
      openspec-ui-cli: will not run "dependent": this change declares
      that it is blocked by groundwork, which is still active. Land it
      and archive it, or remove the line from
      openspec/changes/dependent/.openspec.yaml — there is no option
      that starts it anyway, because the declaration is a sentence its
      author wrote in a file under version control.
      EXIT=2

  Nothing was spent, and the evidence for that is stronger than an
  absent entry: `.openspec-ui/` did not exist at all afterwards.

  **Then the blocker was archived and the same command run again**, with
  nothing else changed:

      openspec archive groundwork -y
      Change 'groundwork' archived as '2026-09-11-groundwork'.

      openspec-ui-cli run dependent --cwd <repo>
      ▶ verify
      Reviewed the `dependent` change. No tasks needed unchecking.
      EXIT=0

  The declaration resolved exactly as `openspec/README.md` has always
  said it does — the moment the change it names is archived.
