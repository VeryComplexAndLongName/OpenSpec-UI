## 1. Invocation accounting

- [x] 1.1 Add ADR 0053 in docs/adr/0053-usage-is-accounted-per-invocation.md defining identity and legacy accounting.
- [x] 1.2 Add optional invocationId and requestedModel to packages/core/src/security.ts without changing old audit validity.
- [x] 1.3 Update packages/core/src/agent-runner.ts to record one invocation id and requested model on its paired entries, with a fresh id per call.
- [x] 1.4 Extend packages/core/src/agent-usage.ts with per-model token fields and current-model attribution; never derive actual model from the request.
- [x] 1.5 Correct packages/core/src/usage-report.ts to retain every invocation, optional token counters, unknown USD, and cost coverage without double-counting breakdowns.
- [x] 1.6 Update packages/core/src/harness-chain-runner.ts to consume complete sums and optional USD while retaining input-plus-output token ceilings.

## 2. Model and CLI reports

- [x] 2.1 Update packages/core/src/agents/acp-session-driver.ts to carry Codex quota model metadata into usageReported, with current-model attribution and per-field degradation.
- [x] 2.2 Add packages/core/src/change-usage-report.ts to resolve active/archive identity and retained historical audit paths; refuse invalid, unknown, and ambiguous names.
- [x] 2.3 Export the report reader and acceptsModel through packages/core/src/index.ts for the CLI.
- [x] 2.4 Update packages/cli/src/cost-command.ts to use core resolution and show missing/partial USD, all recorded token counters, and model-attribution limits.
- [x] 2.5 Update packages/cli/src/agents-command.ts to expose acceptsModel in JSON and text while preserving effort.
- [x] 2.6 Document cost semantics, requested versus reported model, and archived reports in README.md.
- [x] 2.7 Add a patch changeset for core and CLI through Changesets, without editing package versions directly.
- [x] 2.8 Register usage-report lines and change-lookup refusal templates in packages/core/src/message-register.ts under ADR 0046.
- [x] 2.9 Regenerate docs/messages.md with the new usage-report identifiers.

## 3. Targeted verification

- [x] 3.1 Run packages/core/src/usage-report.test.ts with regressions for multiple/repeated stages, legacy pairing, partial/unknown/zero USD, token fields, and model attribution.
- [x] 3.2 Run packages/core/src/agent-runner.test.ts covering paired ids, requested model, repeated calls, and absent model.
- [x] 3.3 Run the usage-related tests in packages/core/src/agents/acp-session-driver.test.ts including valid and malformed model metadata.
- [x] 3.4 Run packages/core/src/change-usage-report.test.ts for active/archive lookup, retained deleted-worktree paths, invalid names, ambiguity, and no records.
- [x] 3.5 Run selected budget tests in packages/core/src/harness-chain-runner.test.ts proving multiple stages reach the existing ceiling and unknown USD stays unknown.
- [x] 3.6 Run selected report tests in packages/cli/src/report-commands.test.ts proving text/JSON capabilities, complete cost output, archived lookup, and show run model audit.
- [x] 3.7 Run packages/server/src/server.test.ts selected REST/WS event contract tests with the added optional model payload.
- [x] 3.8 Run TypeScript checks for affected core/CLI projects and ESLint only on changed source paths; scan only authored files for English and whitespace.
- [x] 3.9 Validate usage-reports-keep-what-agents-report strictly and run the real CLI against a temporary archived usage fixture.
- [x] 3.10 Run packages/webui/src/transport/contract.test.ts selected usageReported tests to confirm the optional payload reaches both client transports.
- [x] 3.11 Update the identifier inventory and run packages/core/src/message-register.test.ts, preserving the unchanged unregistered-message ceiling of 330.

## Verification evidence

- Core: `vitest run src/usage-report.test.ts src/change-usage-report.test.ts src/agent-runner.test.ts --project core`
  passed 55 tests. After extending the audit-payload assertion, its one
  selected test also passed. The nine initial regressions failed on the old
  code before passing with the implementation.
- ACP: `vitest run src/agents/acp-session-driver.test.ts --project core -t 'reporting what the agent said it spent'`
  passed eight selected tests, including valid and malformed quota metadata.
- Harness: the selected budget, real-run usage, multiple-stage, and
  token-only worktree-path cases in `src/harness-chain-runner.test.ts`
  passed seven tests. Both USD and input-plus-output ceilings stop before
  apply after two measured stages; cache/thought do not change token caps.
- CLI: nine selected tests in `src/report-commands.test.ts` passed, covering
  agent capabilities, sibling worktrees, archived text/JSON, cost coverage,
  true zero, refusals, and requested model/id in show run.
- Contracts: two selected tests in `packages/server/src/server.test.ts`
  passed over real HTTP/WebSocket; two selected usageReported tests in
  `packages/webui/src/transport/contract.test.ts` passed for both transports.
- `tsc --noEmit -p packages/core/tsconfig.json` and the same command for
  `packages/cli/tsconfig.json` passed. ESLint on changed source paths had
  zero errors and one pre-existing unused-import warning in the Harness.
- The real source CLI passed archived `show cost` in JSON and text (19
  input tokens from two invocations, 86,656 cache-read tokens, no fabricated
  USD), `show run` with requested model/invocation id, and `show agents`
  with model acceptance, against a temporary fixture that was removed.
- `openspec validate usage-reports-keep-what-agents-report --strict` passed.
- Changed-file English, source control-byte, test-budget and changeset-name
  checks passed for all 28 authored files; `git diff --cached --check`
  passed. `changeset status --since HEAD` accepted the patch changeset and
  listed the dependent delivery-package bumps. After preserving signed
  vendor cost adjustments, all ten usage-report tests and lint on those
  updated source/test paths passed again.

The first CI run failed only the message-register ratchet (331 versus its
330 ceiling): the new describeTotal formatter emitted a sentence directly.
Its output and the new usage-report refusals now use ADR 0046's register.
All seven message-register tests passed with the unchanged 330 ceiling and
the regenerated docs page; the 11 change-usage tests and three affected
CLI cost tests also passed. Core/CLI TypeScript checks passed again and
ESLint on the five affected source/test paths had no errors or warnings.
English, source-text and whitespace checks passed for all eight correction
files, bringing the authored scope to 31 files in total.
Full verification is pending the corrected CI run. No complete suite was
run locally.
