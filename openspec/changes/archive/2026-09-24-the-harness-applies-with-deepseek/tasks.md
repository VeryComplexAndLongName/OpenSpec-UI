Asked by the owner on 2026-09-24: apply with DeepSeek, review with
Copilot on its Codex model.

## 1. The workspace's harness

- [x] 1.1 `apply`: `deepseek-cli-acp`, with no model, effort or budget.
- [x] 1.2 `review`: `copilot-cli-acp`, model `gpt-5.3-codex`, effort
  `high`. The name was checked against Copilot CLI 1.0.83 on 2026-09-24:
  `chatgpt-5.3-codex` refused, `gpt-5.3-codex` answered.
- [x] 1.3 `timeout`: `maxStageSeconds` 3600, `maxRunSeconds` 10800.

## 2. Checks

- [x] 2.1 The file resolved through core's `resolveHarnessConfig`, and
  `findHarnessConfigLimits` read on it: the stage-unbounded finding for
  `apply` gone once the timeout was set; two ceiling-cannot-act findings
  left, for `review` and `apply`, as the proposal says.
- [x] 2.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Typecheck 0, lint 0. Test did
  not reach 0 here in three full runs on 2026-09-24, each failing on
  timing in a file this change does not touch, and a different one each
  time: two `delegated-item-reply.test.ts` cases past their 20 s ceiling;
  `landed-archive.test.ts`, whose fixture's `git push` died in Git's own
  `sh.exe` ("add_item ... errno 1"); `successor-check.test.ts` past 20 s
  and an EBUSY removing a temporary directory. Run alone,
  `successor-check` and `delegated-item-reply` pass 13 of 13 in 10 s.
  Every other package passed every time (server 493, extension 116,
  webui 665). The change is one JSON file no test reads, so the full run
  on CI's clean runner is the one that stands for this item.
- [x] 2.3 `openspec validate the-harness-applies-with-deepseek --strict`,
  and the merge gate locally with `--base origin/main`. Validate: valid;
  the gate exit 0.
