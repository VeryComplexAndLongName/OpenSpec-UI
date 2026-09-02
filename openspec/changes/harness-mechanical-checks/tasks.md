Path this change must hold end to end: a task line names a check →
`task-checklist.ts` parses the name and its parameter → the registry
resolves the name to a function → `verify` runs it → the result writes
the checkbox → a failure skips the verifying agent. A parser that reads
the name but a stage that never runs it, or a run that marks the checkbox
from the agent's report instead of the result, satisfies a shallow test
and changes nothing. Check every junction.

Note on local checks: `npm run lint` runs `lint:english` before eslint.
Both work again as of 2026-09-02; before that, a missing-file error in
the first meant eslint had not run here for days and a real error reached
CI unchecked. Run `npm run lint` in full, and do not assume a familiar
failure is the old one.

## 1. The registry

- [ ] 1.1 New `packages/core/src/mechanical-checks.ts`: export a registry
  mapping a check name to a function returning pass or fail with a
  reason. Names, and nothing beyond them, are what a `tasks.md` may
  select. Do **not** accept a command string, an argument array, or any
  shell text from a caller — ADR 0019's first rejected alternative.
- [ ] 1.2 Same file: the initial names are `validate-change`,
  `typecheck`, `test`, `lint`, `path-unchanged` and `changeset-present`.
  These are what the recurring Verification sections already contain; do
  not invent additional ones speculatively.
- [ ] 1.3 Same file: `path-unchanged` takes a repository-relative path
  and is the only check taking a parameter. Validate it the way
  `checkCwdSandbox` validates a path — it must stay inside the workspace
  and must not escape via `..`.
- [ ] 1.4 Same file: every check reports its failure reason in terms a
  reader can act on — which command, which path, what came back. A check
  that fails with "check failed" is worse than a task an agent narrated.

## 2. Parsing

- [ ] 2.1 `packages/core/src/task-checklist.ts`: a task line may carry a
  check name and its optional parameter. Decide the syntax here — it must
  be unambiguous against `TASK_CHECKBOX_LINE_RE` and must read as ordinary
  markdown, since these files are read by people far more often than by
  the parser.
- [ ] 2.2 Same file: a task with no check parses exactly as today, and
  `TASK_CHECKBOX_LINE_RE`'s existing behavior is unchanged. Every existing
  `tasks.md` in this repository must parse identically before and after.
- [ ] 2.3 Same file: an unrecognized check name is a parse **error**
  naming the unknown name and listing the valid ones — not a silently
  ignored task. A misspelled check that quietly becomes an ordinary task
  is the failure this change exists to remove, reintroduced.
- [ ] 2.4 `task-checklist.test.ts`: a task with a check, a task without,
  an unknown name, and a `path-unchanged` whose path escapes the
  workspace.

## 3. Running them in `verify`

- [ ] 3.1 `packages/core/src/harness-chain-runner.ts`: at the start of
  the `verify` stage, run every mechanical check the change's `tasks.md`
  declares, before the stage's agent is invoked.
- [ ] 3.2 Same file: a check that passes marks its task `[x]`. A check
  that fails leaves it unchecked. The **agent never marks a task that
  carries a check** — if the agent's report and the check disagree, the
  check is right, so the report must not be able to overwrite it.
- [ ] 3.3 Same file: if any mechanical check fails, the verifying agent
  is **not invoked at all**, and the stage ends reporting which checks
  failed. Asking a model to review work that does not typecheck spends a
  run to learn what a compiler already said.
- [ ] 3.4 Same file: when all pass, their results go into the verifying
  agent's prompt, so it knows what is already established. Do **not**
  leave the agent to re-run them — that is the duplicated work this
  change removes.
- [ ] 3.5 Same file: a change whose `tasks.md` declares no checks behaves
  exactly as today — the agent runs, nothing is marked mechanically.

## 4. `archive` stops offering an agent

- [ ] 4.1 `packages/core/src/harness-step-agent.ts`: `stepAgents` no
  longer accepts an `archive` entry. `archive` stays a `HarnessStage` —
  it is a real stage, it simply invokes no agent.
- [ ] 4.2 `packages/core/src/harness-config.ts`: a configuration that
  sets `stepAgents.archive` is **read**, its `archive` entry dropped with
  a warning naming the file, and the rest honoured. Do **not** reject the
  file: this repository's own `openspec/agent-harness.json` sets it
  today, and so does every workspace that copied the documented example.
- [ ] 4.3 `openspec/agent-harness.json`: remove the `archive` entry from
  this repository's own configuration.
- [ ] 4.4 `packages/webui/src/components/HarnessSettingsView.tsx`'s
  `STAGES` and `packages/extension/src/commands.ts`'s
  `HARNESS_TEMPLATE_STAGES`: `archive` is still shown as a stage but
  offers no agent or model picker. Do **not** remove it from the stage
  list — it runs, and hiding it would misrepresent the chain.
- [ ] 4.5 `harness-config.test.ts`: a config with `stepAgents.archive`
  loads, warns, and yields a config without it; a config without one is
  unaffected.

## 5. Tests

- [ ] 5.1 `mechanical-checks.test.ts`: each registry entry is exercised
  in **both** outcomes. A check only ever seen passing is a check whose
  failure path is unverified, and its failure path is what marks a task
  incorrectly.
- [ ] 5.2 `harness-chain-runner.test.ts`: a `verify` stage with all
  checks passing marks their tasks and invokes the agent; with one
  failing, marks none of that one's, invokes **no** agent, and reports the
  failure.
- [ ] 5.3 Same file: an agent that reports a checked task as done does
  not cause it to be marked. Assert this explicitly — it is the whole
  point of task 3.2 and the one thing a naive implementation gets wrong.
- [ ] 5.4 Same file: a change declaring no checks produces byte-identical
  behavior to before this change.

## 6. Verification

- [ ] 6.1 `openspec change validate --strict harness-mechanical-checks`.
- [ ] 6.2 `npm run typecheck`, `npm run lint` and `npm run test` — green
  across all four workspaces.
- [ ] 6.3 Every existing `tasks.md` under `openspec/changes/` still
  parses, with the same task counts as before. Assert this over the real
  directory, not a fixture: the parser change is the one thing here that
  could silently alter every change in the repository.
- [ ] 6.4 `git diff packages/core/src/agents/` is **empty**. This change
  touches how tasks are checked, not how agents are run.
- [ ] 6.5 Version bump via `npx changeset` (`@openspec-ui/core` minor,
  plus the packages whose settings surface changed).
- [ ] 6.6 **Human-only, cannot be completed by an implementing agent**:
  run a chain on a change whose `tasks.md` declares a failing mechanical
  check, and confirm from the run's own output that the verifying agent
  was never invoked and that the failing check is named. Then fix the
  cause, re-run, and confirm the task is marked without an agent having
  claimed it.
