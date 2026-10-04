Requested by the owner on 2026-10-04 (ADR 0039): rules over the records
that already exist, which suggest and change nothing, on by default.

## 1. The decision

- [x] 1.1 ADR 0039 written and listed in `docs/adr/README.md` as Accepted;
  the owner agreed its content in the discussion of 2026-10-04: advise by
  default, decisions made by rules rather than a model, a stop only
  recommended, failures diagnosed before anything is repeated, and
  parallel agents within a change set aside until measured.

## 2. The diagnosis

- [x] 2.1 `packages/core/src/failure-diagnosis.ts` (no Node imports):
  `diagnoseFailure({ agentId, reason, output })`, the causes and patterns
  of design.md decision 2, the quoted line, the remedy naming the agent's
  executable. Test in `failure-diagnosis.test.ts`: each cause from the
  text it is matched on, the order between two causes, whole-word
  numbers (`4010 tests` is not `401`), the quoted line cut to 200
  characters, unknown. 16 passed.
- [x] 2.2 `protocol.ts`: `FailedEvent.diagnosis?`; `security.ts`:
  `AuditEntry.diagnosis?`.
- [x] 2.3 `agent-runner.ts` keeps the last 8 KiB of the run's `stderr` and
  `stdout` text and attaches the diagnosis to the `failed` event it yields
  and to the terminal audit entry. Test in `agent-runner.test.ts`: a
  stand-in adapter that prints "Authentication required" and fails; one
  that fails on a spawn error; one that completes (no diagnosis); and one
  whose own diagnosis is kept. 28 passed.
- [x] 2.4 `harness-chain-runner.ts`: the chain's ending entry, where a
  stage failed, carries that stage's diagnosis. Test in
  `harness-chain-runner.test.ts` ("records the failed stage's diagnosis
  on the chain's ending").
- [x] 2.5 `last-runs-facts.ts` / `last-runs.ts`: `LastRun.diagnosis?`, from
  the chain's ending or, in an older log, the failed stage's;
  `change-card.ts`: the card's last-run line carries the diagnosis's
  words, and nothing for an unknown cause. Tests in `last-runs.test.ts`
  and `change-card.test.ts`. The run's log (`run-log-facts.ts`,
  `run-log.ts`) carries it on its end record and its summary.

## 3. The supervisor

- [x] 3.1 `harness-config.ts`: `HarnessConfig.supervisor`, validated as in
  design.md decision 5, merged key by key; `harness-config-schema.ts`;
  extension schemas regenerated with `npm run schemas --workspace
  packages/extension`. Tests in `harness-config.test.ts`: absent means
  advise/600/60, `off` from either file, a per-change threshold over a
  global mode, `act` refused, a non-positive or fractional threshold
  refused, an unknown key refused, and the round-trip table.
- [x] 3.2 `packages/core/src/supervisor.ts` (no Node imports):
  `superviseRuns({ statuses, lastRuns, supervisorFor })`, the three kinds
  of design.md decision 3. `hints.ts`: `HintKind` gains them.
  `agent-status.ts`: a permission request sets the activity "waiting for
  a permission", so `activityAt` says when the wait began, as a
  checkpoint's already did (`agent-status.test.ts`). Test in
  `supervisor.test.ts`: silent past and under the threshold, a configured
  threshold, gone and not checking out, waiting (not also silent),
  waiting under the threshold, a last run that cannot be repeated, one
  that can (`likely`) or may (`unknown`), one followed by a completed run,
  one whose change has a live run, `off` for the workspace and for one
  change, stable ids. 13 passed.
- [x] 3.3 `pipeline-readings.ts`: `readSupervisorHints(workspaceRoot,
  config)`, used by the Pipeline and by `advise`: the supervisor's hints
  appended to the others, none under `off`, a change's own `off`
  followed, none at all under `hints.enabled: false`. Test in
  `pipeline-readings.test.ts`. 7 passed.

## 4. Surfaces

- [x] 4.1 `packages/webui`: `FailureDiagnosisNote`, shown beneath a failure
  in `HarnessChainPanel`, the AI panel and `RunLogsView`. Tests in
  `FailureDiagnosisNote.test.tsx`, `HarnessChainPanel.test.tsx`,
  `AiPanel.test.tsx` and `RunLogsView.test.tsx`.
- [x] 4.2 Both Harness Settings views: a Supervisor choice (Advise, Off; and
  Inherit in a change's), saved with the rest; the global view writes no
  mode for Advise, the default. Tests in `GlobalHarnessSettingsView.test.tsx`
  and `ChangeHarnessSettingsView.test.tsx`.
- [x] 4.3 `packages/cli`: `advise` prints the supervisor's hints after the
  others (text and JSON); `render-run.ts` prints a diagnosis after a
  failure, and nothing more for an unknown cause. Tests in
  `advise-command.test.ts` and `render-run.test.ts`.

## 5. Documents

- [x] 5.1 `HARNESS.md`: a `supervisor` key section with the three
  suggestions, what it never does, and the causes table; the key in the
  top-level list and the merge rules; a row in "Find what you need".
- [x] 5.2 A changeset: core, webui, server, cli, extension, minor.

## 6. Checks

- [x] 6.1 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, unpiped, exit code 0. 2026-10-04: typecheck 0; lint 0
  after one fix (a stand-in generator in `agent-runner.test.ts` that
  threw without yielding). The root `test` was cut by the 10-minute limit
  on background commands, so its parts were run one by one, each exit 0:
  the seven script tests; `core` 145 files, 2058 tests; `cli` 21/195;
  `server` 4/118; `webui` 77/696; `extension` 36/499; and
  `core-git-subprocess` file by file, 7 files, 62 tests. That last project
  failed two tests when run alongside the other packages: a local
  `git push` and `fetch` met `sh.exe: *** fatal error - add_item ...
  errno 1`, the MSYS shell this project already keeps in a project of its
  own. The same files pass alone here and on `main` (`0e00d3e2`), and
  nothing in this change touches git.
- [x] 6.2 `openspec validate the-supervisor-advises --strict`, and the
  merge gate with the worktree's absolute path as `--cwd` and
  `--base origin/main`. 2026-10-04: "Change 'the-supervisor-advises' is
  valid"; the gate owes only 6.4, the Human-only item.
- [x] 6.3 One live failure diagnosed end to end. Run `openspec-ui-cli run` on
  a scratch change with an agent that is not signed in or not on the PATH,
  and record the printed diagnosis and the audit entry's `diagnosis`; then
  `openspec-ui-cli advise` in the same repository, recording the
  `last-run-cannot-be-repeated` suggestion.
  Record, 2026-10-04: a scratch repository with one change,
  `greet-by-name`, whose `harness.json` names `gemini-cli` for every stage
  and runs unattended; `gemini` is not on this machine's PATH. `run`
  printed `▶ apply — gemini-cli`, the shell's own "'gemini' is not
  recognized as an internal or external command", then
  `✗ spawn gemini ENOENT`, "the agent is not installed: repeating will not
  help", `it printed: "spawn gemini ENOENT"`, the remedy naming `gemini`,
  and `$ openspec-ui-cli doctor`; exit 1. The audit log holds the stage's
  `failed` entry and the chain's ending, both with
  `"diagnosis":{"cause":"agent-not-installed","repeatHelps":"no",...}`.
  `advise` then printed "greet-by-name's last run failed at apply, and
  repeating it will not help", with the same words, the remedy and
  `$ openspec-ui-cli doctor`, after the readiness report's own
  suggestion; exit 0.
- [ ] 6.4 **Human-only**: in the Pipeline of either host, see a run that
  says nothing new and a failed run's card with its diagnosis, and the
  Supervisor choice in Harness Settings.
