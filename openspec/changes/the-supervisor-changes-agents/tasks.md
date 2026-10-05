Requested by the owner on 2026-10-04 and 2026-10-05 (ADR 0039 decision 4):
the supervisor may change a stage's agent where a change's configuration
allows it, under a configured policy, and always says so.

## 1. Core

- [x] 1.1 `agents/registry.ts`: `AgentDescriptor.provider` for every agent
  (design.md decision 3). Test in `registry.test.ts`: every agent has one.
  Every registry entry has `provider`; `registry.test.ts`: 5 passed.
- [x] 1.2 `harness-config.ts` and `harness-config-schema.ts`: `act`,
  `fallback`, `allowCostIncrease`, `allowProviderChange`, with the rules of
  decisions 1 and 2; extension schemas regenerated. Tests in
  `harness-config.test.ts`: act in the global file, without autonomous,
  with one attempt, accepted with all three; a fallback with an unknown
  agent, with `vscode-chat`, with a repeated id, for a stage without an
  agent; the allowances refused in the global file.
  `act`, `fallback` and the allowances, schema by scope, extension
  schemas regenerated; `harness-config.test.ts`: 201 passed, six new under
  "supervisor act".
- [x] 1.3 `supervisor.ts`: `superviseFailure` (decision 4). Test in
  `supervisor.test.ts`: repeat on `likely`; move to the first allowed
  untried fallback; a provider change refused and named; a cost increase
  refused and named; a local fallback allowed without
  `allowCostIncrease`; nothing tried twice; `unknown` and no fallback.
  `superviseFailure` and `fallbackRefusal`; seven new cases in
  `supervisor.test.ts`, 34 passed with `last-runs` and `registry`. After
  4.3, a move names the fallbacks it passed over and why ("passed over:
  copilot-cli-acp may cost money, and allowCostIncrease is false");
  `supervisor.test.ts` 22 passed.
- [x] 1.4 `harness-chain-runner.ts`: the held failure and the act loop
  (decision 5). Tests in the chain runner's tests: a stage moved to its
  fallback, with the progress line, the audit entry, the new agent's
  `stageStarted` and no `failed` before it; a repeat on a rate limit; a
  refused fallback ending with the original failure; no attempt left
  ending with it; `advise` unchanged.
  `runStage` holds the agent's `failed`; `superviseHeldFailure` repeats,
  moves or yields it; audit `supervisorDecision` on a `supervisor` message
  entry. Five new cases in `harness-chain-runner.test.ts`; the core project
  2095 passed. Found in 4.3: `claude-cli-acp` says "Not logged in · Please
  run /login" as an ACP message, not on stderr, so its failure was
  diagnosed unknown and `act` could do nothing with it; `agent-runner.ts`
  now adds what an ACP agent says to the tail it diagnoses. One new case in
  `agent-runner.test.ts`, 29 passed.
- [x] 1.5 `supervisor.ts` / `pipeline-readings.ts`: under `advise`, the
  last-run suggestion names the allowed fallback (decision 6). Test in
  `supervisor.test.ts`.
  `aboutLastRuns` adds the fallback sentence from the last run's agent
  (`last-runs.ts` now reads it); two new cases in `supervisor.test.ts`.

## 2. Surfaces

- [x] 2.1 `packages/webui`: the change's Harness Settings (decision 7).
  Tests in `ChangeHarnessSettingsView.test.tsx`: Act offered only under
  Autonomous, the note shown, the fallback and the allowances saved; the
  global view offers neither.
  Act under Autonomous only, the warning, the fallback per stage, the
  allowances, a second attempt asked for; three new cases in
  `ChangeHarnessSettingsView.test.tsx`, one assertion in the global view's;
  65 passed.
- [x] 2.2 `packages/cli`: `render-run.ts` prints a stage's reason under a
  repeated or moved heading. Test in `render-run.test.ts`.
  The reason under the heading, not repeated after the supervisor's own
  line; two new cases in `render-run.test.ts`, 15 passed.

## 3. Documents

- [x] 3.1 `HARNESS.md`: the supervisor's `act`, the policy, the providers,
  what it never does.
  `HARNESS.md`, `supervisor`, "Act".
- [x] 3.2 A changeset: core, webui, server, cli, extension, minor.
  `.changeset/the-supervisor-changes-agents.md`.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint`, and every test project, each
  on its own where the root run would exceed a background limit.
  Typecheck clean; lint 0 errors (3 warnings, in lines this change did not
  touch); the seven script tests pass. Core 2095, core-git-subprocess 67,
  cli 201, webui 711, server 122, extension 502 passed.
- [x] 4.2 `openspec validate the-supervisor-changes-agents --strict`, and
  the merge gate with the worktree's absolute path as `--cwd`.
  Valid; the gate's record is in the pull request.
- [x] 4.3 One live move end to end: a scratch change whose `apply` agent is
  not on the PATH, under `act` with a fallback the policy allows, run with
  `openspec-ui-cli run`; record the printed move, the audit entries, and
  the fallback agent's run.
  Record, 2026-10-05: the scratch repository of the-supervisor-advises 6.3,
  change `greet-by-name`, autonomous, `maxStageAttempts: 2`, `apply` on
  `gemini-cli` (not on the PATH), `supervisor` `act` with
  `fallback.apply: ["copilot-cli-acp", "local-llm-acp"]` and only
  `allowProviderChange`, the local LLM a stand-in server on 127.0.0.1.
  `run` printed `▶ apply — gemini-cli`, then "· the supervisor moved apply
  from gemini-cli to local-llm-acp: the agent is not installed: repeating
  will not help (passed over: copilot-cli-acp may cost money, and
  allowCostIncrease is false)", then `▶ apply — local-llm-acp (attempt 2)`;
  the fallback wrote `hello.txt` and completed, and the chain went on to
  verify, which ended it with the task still unchecked (the stand-in ticks
  nothing). No `failed` event for the first attempt. The audit log holds
  `gemini-cli` failed (agent-not-installed), a `supervisor` message entry
  with `supervisorDecision` {move, apply, gemini-cli → local-llm-acp, the
  cause}, then `local-llm-acp` started and completed at apply. With
  `fallback.apply: ["claude-cli-acp"]` and both allowances, the move went to
  `claude-cli-acp`, which is not signed in on this machine; after the
  agent-runner fix it printed "the supervisor did not try apply again: the
  agent is not signed in: repeating will not help, and every fallback for
  apply has been tried" and ended with that diagnosis and its remedy.
- [ ] 4.4 **Human-only**: in a change's Harness Settings in either host, see
  Act offered under Autonomous with its note, and set a fallback.
