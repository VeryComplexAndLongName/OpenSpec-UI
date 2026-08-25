## Why

Found during a repository review session on 2026-08-25, after
`retranslate-legacy-comments-to-english` (archived as
`2026-08-25-retranslate-legacy-comments-to-english`) had already merged:
`operations.apply.guidance` in `openspec/config.yaml` requires "A version
bump in the affected package's package.json ... in sync with every
externally visible behavior change." That change's own `proposal.md`
explicitly flagged that `packages/core/src/agents/shared.ts`'s
`commandInstruction()` changed behavior beyond a pure comment translation:
the `plan`/`implement`/`review`/`status`/`cancel` branches now return
English instruction text instead of Russian — this is the literal prompt
prefix sent to CLI agents (Claude/Copilot/Codex/Gemini), a real runtime
behavior change to `packages/core`'s output. `packages/core/package.json`
was not bumped in that change, which is a gap against the repo's own
versioning rule.

## What Changes

- Bump `packages/core/package.json` from `0.20.2` to `0.20.3` (patch: a
  behavior change — the text of an existing function's output — without
  changing `packages/core`'s public TypeScript API or the command/event
  protocol).
- No code change; this only reconciles the version number with behavior
  that already shipped in `2026-08-25-retranslate-legacy-comments-to-english`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this change does not itself modify behavior — it corrects a version
number that should have moved with a behavior change already shipped in a
prior archived change)

## Impact

- `packages/core/package.json`
