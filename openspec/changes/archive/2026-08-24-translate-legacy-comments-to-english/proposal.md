## Why

A repository review session on 2026-08-24 found that `CLAUDE.md`'s mandatory
English-only policy ("All code comments, descriptions, and markdown files in
this repository must be written in English only") is enforced by
`scripts/check-english.mjs` (`npm run lint:english`), but that script's
`scripts/english-policy-baseline.json` grandfathers in every line of
Cyrillic text that existed when the policy was introduced. The baseline held
635 lines across 73 tracked files — comments, JSDoc, and a handful of test
fixture strings — silently exempted from a policy that is supposed to apply
repo-wide. This is baseline debt: the check passes, but the policy is not
actually met for pre-existing content.

## What Changes

- Translate all 635 previously baselined lines, across all 73 affected
  files, from Russian to English, preserving technical meaning exactly
  (not a rewrite or a summary — a faithful translation of comments,
  JSDoc, and the two archived-change markdown notes files).
- Where a baselined line's Russian text was itself the value under test
  (`packages/core/src/change-state.test.ts`'s fixture markdown,
  `packages/webui/src/markdown.test.tsx`/`SpecsSearch.test.tsx`/
  `SpecsTree.test.tsx`/`RequirementView.test.tsx`/`ChangeRelations.test.tsx`'s
  sample strings, `packages/core/src/security.test.ts`'s and
  `packages/core/src/agent-runner.test.ts`'s prompt-injection fixture text),
  translate the fixture content too and update the corresponding assertions
  in the same file so the test keeps checking the same behavior. None of the
  635 lines were left untouched — every baselined line was either a
  translatable comment/JSDoc/doc line, or fixture text whose language is
  incidental to what the test verifies (substring/shape checks, not a
  byte-for-byte external contract). `packages/core/src/openspec-fixtures/show.json`
  (explicitly exempt from scanning, a real `openspec` CLI capture) and
  `scripts/check-english.test.mjs` (Cyrillic is the intentional subject of
  that file's own scanner tests, marked `english-policy-allow`) were correctly
  never baselined and were left as-is.
- `packages/core/src/agents/shared.ts`'s `commandInstruction()` also
  returned Russian text for the `plan`/`implement`/`review`/`status`/
  `cancel` command kinds — this is not a comment, it is the literal
  instruction prefix sent to CLI agents (Claude/Copilot/Codex/Gemini/local
  LLM) as part of the real prompt. The `list`/`show`/`validate` branches of
  the same `switch` were already in English, so the function was internally
  inconsistent before this change. Translated the remaining branches to
  English to match, which is a small runtime behavior change (the literal
  text sent to CLI agents for those five command kinds) beyond pure comment
  translation — flagged explicitly here since it is not "no behavior change"
  in the strictest sense, even though no test asserts the exact string and
  all CLI agents understand English at least as well as Russian.
- Regenerate `scripts/english-policy-baseline.json` via
  `node scripts/check-english.mjs --write-baseline` after all translations
  were complete, so it now reflects the true remaining state (empty — no
  Cyrillic remains in scanned files outside the two exempt cases above).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; `.openspec.yaml` sets `skip_specs: true`. Primarily comment/doc/test-
fixture-text translation; the one exception —
`commandInstruction()`'s runtime prompt text — does not change any command
or event in the protocol defined in `packages/core`, so it does not rise to
a specified capability change)

## Impact

- `eslint.config.js`
- `openspec/changes/archive/2026-08-13-standalone-app/smoke-test-notes.md`
- `openspec/changes/archive/2026-08-13-vscode-extension/TEST-NOTES.md`
- `packages/core/src/agent-runner.ts`, `agent-runner.test.ts`
- `packages/core/src/agents/claude.ts`, `codex.ts`, `copilot.ts`, `gemini.ts`,
  `local-llm.ts`, `registry.ts`, `shared.ts`, `shared.test.ts`
- `packages/core/src/browser.ts`, `change-state.ts`, `change-state.test.ts`,
  `default-runners.ts`, `git.ts`, `index.ts`, `openspec.ts`,
  `openspec.test.ts`, `protocol.ts`, `security.ts`, `security.test.ts`
- `packages/extension/scripts/build-options.mjs`
- `packages/extension/src/commands.ts`, `config.ts`, `extension.ts`,
  `run-controller.ts`, `vitest.config.ts`
- `packages/extension/src/native/diff.ts`, `git.ts`, `open-doc.ts`
- `packages/extension/src/test-utils/vscode-mock.ts`
- `packages/extension/src/test/run.mjs`, `test/suite/extension.test.ts`,
  `test/suite/index.ts`
- `packages/extension/src/webview/ai-panel.ts`
- `packages/server/scripts/build-client.mjs`, `client-build-options.mjs`
- `packages/server/src/cli.ts`, `index.ts`, `rest.ts`, `server.ts`,
  `server.test.ts`, `static.ts`, `static.test.ts`, `websocket.ts`, `wire.ts`
- `packages/webui/src/components/AiPanel.tsx`, `ArchiveList.tsx`,
  `ChangeDiff.tsx`, `ChangeRelations.tsx`, `ChangeRelations.test.tsx`,
  `ChangesList.tsx`, `RequirementView.tsx`, `RequirementView.test.tsx`,
  `SpecsSearch.tsx`, `SpecsSearch.test.tsx`, `SpecsTree.tsx`,
  `SpecsTree.test.tsx`, `TasksChecklist.tsx`
- `packages/webui/src/extension-entry.tsx`, `index.ts`, `markdown.tsx`,
  `markdown.test.tsx`, `standalone-entry.tsx`, `types.ts`
- `packages/webui/src/transport/contract.test.ts`,
  `fetch-transport.ts`, `fetch-transport.test.ts`,
  `message-bridge-transport.ts`, `types.ts`
- `scripts/english-policy-baseline.json` (regenerated to reflect zero
  remaining Cyrillic lines in scanned files)
