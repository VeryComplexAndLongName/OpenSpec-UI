## 1. Translate `packages/core`

- [x] 1.1 Translate comments in `git.ts`, `index.ts`, `browser.ts`,
  `default-runners.ts`, `change-state.ts`, `change-state.test.ts`,
  `openspec.ts`, `openspec.test.ts`, `protocol.ts`.
- [x] 1.2 Translate `security.ts` (39 baselined lines: allowlist/cwd-sandbox
  decision messages, the `prepareAgentContext` data/instructions header,
  audit-log JSDoc) faithfully, preserving the security-invariant wording;
  update `security.test.ts`'s matching assertions and its
  prompt-injection fixture text to stay consistent with the translated
  implementation strings it checks against.
- [x] 1.3 Translate `agent-runner.ts`/`agent-runner.test.ts`, including the
  fallback failure-reason strings and the prompt-injection scenario text
  in the test.
- [x] 1.4 Translate `agents/claude.ts`, `codex.ts`, `copilot.ts`, `gemini.ts`,
  `local-llm.ts`, `registry.ts`, `shared.ts` (including the per-command
  `commandInstruction()` prompt strings — a runtime behavior change, see
  proposal.md's "What Changes"), `shared.test.ts`.

## 2. Translate `packages/server`

- [x] 2.1 Translate comments in `cli.ts`, `index.ts`, `websocket.ts`,
  `wire.ts`, `rest.ts`, `static.ts`, `server.ts`, `static.test.ts`,
  `server.test.ts`, `scripts/build-client.mjs`,
  `scripts/client-build-options.mjs`.

## 3. Translate `packages/extension`

- [x] 3.1 Translate comments in `config.ts`, `commands.ts`, `extension.ts`,
  `native/diff.ts`, `native/git.ts`, `native/open-doc.ts`,
  `run-controller.ts`, `test-utils/vscode-mock.ts`, `webview/ai-panel.ts`.
- [x] 3.2 Translate comments in `test/suite/index.ts`,
  `test/suite/extension.test.ts`, `test/run.mjs`, `vitest.config.ts`,
  `scripts/build-options.mjs`.

## 4. Translate `packages/webui`

- [x] 4.1 Translate comments in `types.ts`, `transport/types.ts`, `index.ts`,
  `transport/message-bridge-transport.ts`, `transport/fetch-transport.ts`,
  `transport/fetch-transport.test.ts`, `transport/contract.test.ts`.
- [x] 4.2 Translate comments in `standalone-entry.tsx`,
  `extension-entry.tsx`, `markdown.tsx`; translate `markdown.test.tsx`'s
  sample strings and update its matching assertions.
- [x] 4.3 Translate `components/TasksChecklist.tsx`,
  `components/RequirementView.tsx`, `components/RequirementView.test.tsx`
  (sample requirement text + assertions), `components/SpecsSearch.tsx`,
  `components/SpecsSearch.test.tsx` (fixture specs + query strings +
  assertions), `components/SpecsTree.tsx`, `components/SpecsTree.test.tsx`
  (fixture specs), `components/ChangesList.tsx`, `components/ChangeDiff.tsx`,
  `components/ChangeRelations.tsx`, `components/ChangeRelations.test.tsx`
  (fixture proposal text + assertions), `components/ArchiveList.tsx`,
  `components/AiPanel.tsx`.

## 5. Repo-level files

- [x] 5.1 Translate `eslint.config.js`'s comment.
- [x] 5.2 Translate
  `openspec/changes/archive/2026-08-13-standalone-app/smoke-test-notes.md`
  and `openspec/changes/archive/2026-08-13-vscode-extension/TEST-NOTES.md`
  in full (both are historical live-test notes from archived changes; no
  functional content, safe to translate wholesale).

## 6. Baseline and verification

- [x] 6.1 Confirm no file was skipped: `packages/core/src/openspec-fixtures/show.json`
  stays untouched (explicitly exempt from scanning — a captured real
  `openspec` CLI response) and `scripts/check-english.test.mjs` stays
  untouched (its Cyrillic lines are the intentional subject of the
  scanner's own tests, marked `english-policy-allow`, and were never
  baselined in the first place).
- [x] 6.2 Regenerate `scripts/english-policy-baseline.json` via
  `node scripts/check-english.mjs --write-baseline` after all translations
  above are complete.
- [x] 6.3 `npm run lint:english` passes (0 violations, empty baseline).
- [x] 6.4 `npm run typecheck` passes workspace-wide.
- [x] 6.5 `npm run test` passes workspace-wide (test:english + all package
  test suites — 435 tests total, 0 failures).
- [x] 6.6 `openspec change validate --strict translate-legacy-comments-to-english`
  passes.
- [x] 6.7 Reviewed independently (diff read for the highest-risk files —
  `security.ts`/`security.test.ts`, `agents/shared.ts`, a sample
  fixture+assertion pair in `SpecsSearch.test.tsx`) and re-ran
  `typecheck`/`lint`/`test` from a clean checkout of the merged result, not
  just trusting the translating agent's self-report.
