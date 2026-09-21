Raised by `a-landed-change-is-archived-for-you` (deferred) and asked for
first by the owner on 2026-09-21.

## 1. Built from core

- [x] 1.1 `harnessConfigJsonSchema(scope)` in `packages/core`, built from
  the validator's lists: top-level keys, the stages that take an agent,
  the agent registry and each agent's flags, efforts and budget unit,
  autonomy levels, the task-number pattern, the chain steps, and the rules
  of the global file. It throws when a top-level key has no entry.
- [x] 1.2 `npm run schemas --workspace packages/extension` writes both
  files; they are regenerated.

## 2. Held to the validator

- [x] 2.1 A test compares the checked-in files with core's output, and the
  schema's top-level keys with `TOP_LEVEL_CONFIG_KEYS`.
- [x] 2.2 A test runs the validator and the schema over every agent with
  every field an entry may carry, and over every rule a file is held to,
  in both scopes, and requires them to agree. It also requires both
  answers to occur more than 30 times, so it cannot pass by agreeing
  about nothing.
- [x] 2.3 The known differences are listed with their reasons and
  asserted as differences: a stage ceiling above the chain's, a stage
  time above the run's, and an unknown key in `budget` or `timeout`.

## 3. Checks

- [x] 3.1 The test fails on the schemas this replaces: 64 disagreements
  in each scope, starting with a bare `claude-cli` entry.
- [x] 3.2 The repository's own 16 harness files: the old schemas flag 10,
  the new ones none.
- [x] 3.3 `npm run typecheck && npm run lint && npm run test` at the
  root, after `git add`, run unpiped. typecheck and lint pass. Tests:
  cli 175, core 1751 and 31, extension 482 (8 of them new), server 112,
  webui 639 of 640. The one failure is
  `packages/webui/scripts/build-metro-icons.test.mjs`, which fails on
  Windows for its line endings and fails the same way on untouched `main`.
- [x] 3.4 The extension's integration suite passes: 18 passing.
- [x] 3.5 A changeset: core and the extension, patch.
- [x] 3.6 `openspec validate the-harness-schemas-know-every-key --strict`.
