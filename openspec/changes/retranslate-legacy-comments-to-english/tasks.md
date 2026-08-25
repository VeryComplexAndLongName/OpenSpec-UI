## 1. Repo-level files

- [x] 1.1 Translate `eslint.config.js`'s comment.

## 2. Translate `packages/core` (non-agent files)

- [x] 2.1 Translate `git.ts`, `index.ts`, `browser.ts`, `default-runners.ts`,
  `change-state.ts`, `change-state.test.ts` (fixture task text + `it()`
  titles), `openspec.ts`, `openspec.test.ts`, `protocol.ts`.
- [x] 2.2 Translate `agent-runner.ts` (including its two fallback
  failure-reason strings — flagged in proposal.md as a small runtime-text
  change) and `agent-runner.test.ts` (including its prompt-injection
  fixture text and matching assertion).

## 3. Translate `packages/core/src/security.ts` and `security.test.ts`

- [x] 3.1 Translate `security.ts` (allowlist/cwd-sandbox decision messages,
  the `prepareAgentContext` data/instructions header, audit-log JSDoc)
  faithfully, preserving the security-invariant wording exactly.
- [x] 3.2 Translate `security.test.ts`'s comments and any fixture/assertion
  text that mirrors `security.ts`'s translated strings, keeping the tests
  aligned with the implementation. Verified with
  `npm run test --workspace packages/core` (170 tests passed).

## 4. Translate `packages/core/src/agents/*`

- [x] 4.1 Translate `claude.ts`, `codex.ts`, `copilot.ts`, `gemini.ts`,
  `local-llm.ts`, `registry.ts`.
- [x] 4.2 Translate `shared.ts`, including the per-command
  `commandInstruction()` prompt strings for `plan`/`implement`/`review`/
  `status`/`cancel` (a runtime behavior change, see proposal.md's
  "What Changes") and `shared.test.ts`.

## 5. Translate `packages/server`

- [x] 5.1 Translate comments in `cli.ts`, `index.ts`, `websocket.ts`,
  `wire.ts`, `rest.ts`, `static.ts`, `server.ts`, `static.test.ts`,
  `server.test.ts`, `scripts/build-client.mjs`,
  `scripts/client-build-options.mjs`. Verified with
  `npm run test --workspace packages/server` (40 tests passed).

## 6. Translate `packages/extension`

- [x] 6.1 Translate comments in `config.ts`, `commands.ts`, `extension.ts`,
  `native/diff.ts`, `native/git.ts`, `native/open-doc.ts`,
  `run-controller.ts`, `test-utils/vscode-mock.ts`, `webview/ai-panel.ts`.
- [x] 6.2 Translate comments in `test/suite/index.ts`,
  `test/suite/extension.test.ts`, `test/run.mjs`, `vitest.config.ts`,
  `scripts/build-options.mjs`. Verified with
  `npm run test --workspace packages/extension` (101 tests passed).

## 7. Translate `packages/webui`

- [x] 7.1 Translate comments in `types.ts`, `transport/types.ts`, `index.ts`,
  `transport/message-bridge-transport.ts`, `transport/fetch-transport.ts`,
  `transport/fetch-transport.test.ts`, `transport/contract.test.ts`.
- [x] 7.2 Translate comments in `standalone-entry.tsx` (already fully
  English — a prior unrelated change had already replaced its baselined
  lines; nothing left to translate there), `extension-entry.tsx`,
  `markdown.tsx`; translate `markdown.test.tsx`'s sample strings and update
  its matching assertions.
- [x] 7.3 Translate `components/TasksChecklist.tsx`,
  `components/RequirementView.tsx`, `components/RequirementView.test.tsx`
  (sample requirement text + assertions), `components/SpecsSearch.tsx`,
  `components/SpecsSearch.test.tsx` (fixture specs + query strings +
  assertions), `components/SpecsTree.tsx`, `components/SpecsTree.test.tsx`
  (fixture specs), `components/ChangesList.tsx`, `components/ChangeDiff.tsx`,
  `components/ChangeRelations.tsx`, `components/ChangeRelations.test.tsx`
  (fixture proposal text + assertions), `components/ArchiveList.tsx`,
  `components/AiPanel.tsx`. Verified with
  `npm run test --workspace packages/webui` (112 tests passed).

## 8. Repo-level markdown notes

- [x] 8.1 Translate
  `openspec/changes/archive/2026-08-13-standalone-app/smoke-test-notes.md`
  and `openspec/changes/archive/2026-08-13-vscode-extension/TEST-NOTES.md`
  in full (both are historical live-test notes from archived changes; no
  functional content, safe to translate wholesale). Confirmed via repo-wide
  grep that no Cyrillic remains outside the two exempt files
  (`packages/core/src/openspec-fixtures/show.json`,
  `scripts/check-english.test.mjs`).

## 9. Baseline and verification

- [ ] 9.1 Confirm no file was skipped without a documented reason;
  `packages/core/src/openspec-fixtures/show.json` stays untouched
  (explicitly exempt from scanning) and `scripts/check-english.test.mjs`
  stays untouched (its Cyrillic lines are the intentional subject of the
  scanner's own tests, marked `english-policy-allow`, and were never
  baselined).
- [ ] 9.2 Regenerate `scripts/english-policy-baseline.json` via
  `node scripts/check-english.mjs --write-baseline` after all intended
  translations above are complete.
- [ ] 9.3 `npm run lint:english` passes.
- [ ] 9.4 `npm run typecheck` passes workspace-wide.
- [ ] 9.5 `npm run test` passes workspace-wide.
- [ ] 9.6 `npm run lint` passes workspace-wide.
- [ ] 9.7 `openspec change validate --strict retranslate-legacy-comments-to-english`
  passes.
