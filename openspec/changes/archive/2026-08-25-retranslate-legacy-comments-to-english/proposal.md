## Why

`CLAUDE.md`'s mandatory English-only policy ("All code comments,
descriptions, and markdown files in this repository must be written in
English only") is enforced by `scripts/check-english.mjs`
(`npm run lint:english`), but that script's
`scripts/english-policy-baseline.json` grandfathers in every line of
Cyrillic text that existed when the policy was introduced. As of
2026-08-25 the baseline held 635 lines across 70 tracked files —
comments, JSDoc, and a handful of test fixture strings — silently exempted
from a policy that is supposed to apply repo-wide. This is baseline debt:
the check passes, but the policy is not actually met for pre-existing
content.

Note: an earlier attempt at this exact task
(`openspec/changes/archive/2026-08-24-translate-legacy-comments-to-english/`)
was archived on 2026-08-24 as if complete, but its actual file edits were
never committed and were subsequently lost to unrelated concurrent activity
in the same working tree before anything landed in git. The baseline is
still at 635 lines, confirming none of that work survived. This change
redoes the translation from scratch and, unlike the previous attempt,
commits work incrementally inside its own worktree branch so it survives
even if the worktree is later discarded.

## What Changes

- Translate the baselined Russian-language lines, across the affected
  files, from Russian to English, preserving technical meaning exactly
  (a faithful translation of comments and JSDoc, not a rewrite or a
  summary).
- Where a baselined line's Russian text was itself fixture data used by a
  test (e.g. `packages/core/src/agent-runner.test.ts`'s and
  `packages/core/src/security.test.ts`'s prompt-injection scenario text,
  `packages/webui/src/markdown.test.tsx`/`SpecsSearch.test.tsx`/
  `SpecsTree.test.tsx`/`RequirementView.test.tsx`/`ChangeRelations.test.tsx`'s
  sample strings), translate the fixture content and update the matching
  assertions in the same file so the test keeps checking the same
  behavior (substring/shape checks, not a byte-for-byte external
  contract) — never left as Russian text asserted only because that
  happened to be convenient.
- `packages/core/src/agents/shared.ts`'s `commandInstruction()` also
  returned Russian text for the `plan`/`implement`/`review`/`status`/
  `cancel` command kinds — this is not a comment, it is the literal
  instruction prefix sent to CLI agents (Claude/Copilot/Codex/Gemini/local
  LLM) as part of the real prompt. The `list`/`show`/`validate` branches of
  the same `switch` were already in English, so the function was
  internally inconsistent before this change. Translated the remaining
  branches to English to match. This is a small runtime behavior change
  (the literal text sent to CLI agents for those five command kinds)
  beyond pure comment translation — flagged explicitly here since it is
  not "no behavior change" in the strictest sense, even though no test
  asserts the exact string and all CLI agents understand English at least
  as well as Russian.
- `packages/core/src/agent-runner.ts`'s two fallback failure-reason
  strings (used only when the underlying security decision does not
  supply its own `reason`) were also Russian; translated them to English
  for the same reason as `commandInstruction()` — literal user/log-facing
  text, not a comment, but not asserted verbatim by any test either.
- `packages/core/src/openspec.ts` is a JSON-driven CLI wrapper with no
  functional Russian strings — only comments/JSDoc were translated there.
- `packages/core/src/openspec-fixtures/show.json` (explicitly exempt from
  scanning — a captured real `openspec` CLI response) and
  `scripts/check-english.test.mjs` (Cyrillic is the intentional subject of
  that file's own scanner tests, marked `english-policy-allow`) were
  correctly never baselined and are left untouched.
- Regenerate `scripts/english-policy-baseline.json` via
  `node scripts/check-english.mjs --write-baseline` after all intended
  translations are complete.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; `.openspec.yaml` sets `skip_specs: true`. Primarily comment/doc/test-
fixture-text translation; the one exception —
`commandInstruction()`'s runtime prompt text and `agent-runner.ts`'s
fallback reason strings — does not change any command or event in the
protocol defined in `packages/core`, so it does not rise to a specified
capability change)

## Impact

Files touched (updated as work proceeds — see tasks.md for the
authoritative per-file breakdown and any files left untouched with
reasons):

- `eslint.config.js`
- `packages/core/src/*` (git.ts, index.ts, browser.ts, default-runners.ts,
  change-state.ts, change-state.test.ts, openspec.ts, openspec.test.ts,
  protocol.ts, agent-runner.ts, agent-runner.test.ts, security.ts,
  security.test.ts, agents/*.ts)
- `packages/server/src/*`, `packages/server/scripts/*`
- `packages/extension/src/*`, `packages/extension/scripts/*`
- `packages/webui/src/*`
- `openspec/changes/archive/2026-08-13-standalone-app/smoke-test-notes.md`
- `openspec/changes/archive/2026-08-13-vscode-extension/TEST-NOTES.md`
- `scripts/english-policy-baseline.json` (regenerated)
