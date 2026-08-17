## 1. Package scaffold

- [x] 1.1 `packages/cli/package.json` (`@openspec-ui/cli`, private,
  `"main": "src/index.ts"`, depends on `@openspec-ui/core`, dev-depends
  on `tsx`; scripts: `typecheck`, `lint`, `test`, `start` — mirroring
  `packages/server`'s conventions).
- [x] 1.2 `packages/cli/tsconfig.json` extending
  `../../tsconfig.base.json` (same as every other package).

## 2. Validation logic (core-consuming, testable in isolation)

- [x] 2.1 `packages/cli/src/openspec-validate.ts`: `runValidateAll(cwd:
  string): Promise<{ ok: boolean; results: ChangeValidationResult[] }>` —
  lists active changes via `listChanges()`, runs `validateChange()` per
  change in parallel, captures a rejection as that change's own `{ valid:
  false, error }` entry rather than aborting the whole run (see
  design.md, "Per-change validation failure vs. tool-level failure").
- [x] 2.2 `openspec-validate.test.ts`: mocked `@openspec-ui/core`
  (`listChanges`/`validateChange`, same `vi.mock` pattern as
  `server.test.ts`) covering: all valid, one invalid (failedItems > 0),
  one change's `validateChange()` rejecting while others succeed,
  `listChanges()` itself rejecting. 4 tests, all passing.

## 3. CLI entry point (argv parsing, exit codes, output formatting)

- [x] 3.1 `packages/cli/src/main.ts` + thin `src/cli.ts` bin entry:
  parses `--cwd`/`--format json|text`, calls `runValidateAll`, prints
  JSON (default) or a text table, returns the `0`/`1`/`2` exit code (see
  design.md/ADR-0007). Split from `cli.ts` so the argv/exit-code logic is
  unit-testable without spawning a real process (deviates slightly from
  the original single-file plan for testability; `cli.ts` itself is just
  `process.exitCode = await runMain(process.argv.slice(2))`).
- [x] 3.2 `main.test.ts` (renamed from the planned `cli.test.ts` to match
  where the logic actually lives): exit code `0` on all-valid, `1` on
  any-invalid, `2` when `validateAll` rejects and for bad argv
  (unknown command, missing `--cwd` value, invalid `--format`);
  `--format text` produces a readable table. 8 tests, all passing.

## 4. Wire into this repository's own CI

- [x] 4.1 `.github/workflows/quality.yml`: add a job (or a step in an
  existing job that already installs `@fission-ai/openspec`) running
  `npm run start --workspace @openspec-ui/cli -- validate` against this
  repository's own `openspec/` — the real merge-gate demonstration named
  in proposal.md's Why.
  Added a new `openspec-validate` job (`needs: quality`), matching the
  existing `extension-integration`/`browser-e2e` jobs' pattern for
  installing `@fission-ai/openspec@1.7.0` globally.

## 5. Documentation

- [x] 5.1 `README.md`: document the new `ci-cli` capability — what it
  checks, its exit-code contract, and how to run it locally
  (`npm run start --workspace @openspec-ui/cli -- validate`).
  Added a "Packages"/version-table row, and a dedicated "CI CLI (merge
  gate)" section before "Getting Started".

## 6. Verification, versioning, and smoke test

- [x] 6.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/cli` (typecheck clean, lint clean, 12/12 tests). Full-repo
  `npm run verify` re-run still pending until after `git add`/commit.
- [x] 6.2 `packages/cli/package.json` starts at `0.1.0` (new package).
- [x] 6.3 Manual smoke test: ran `validate` for real against this
  repository's own active changes (all-valid path), against a genuinely
  incomplete scratch change (real failure path, exit `1`, one broken
  change didn't abort the run), and against an empty directory (observed
  a pre-existing upstream `openspec` CLI nuance — vacuous `ok: true` for
  "no `openspec/` at all", not a bug in this package). Full detail and
  the exact commands in `smoke-test-notes.md`; scratch fixture removed
  afterward, confirmed via `git status`.
- [x] 6.4 `openspec change validate --strict ci-cli` passes.

## 7. Ship

- [x] 7.1 Branch `feat/ci-cli` from post-merge `origin/main`, commit, push,
  [PR #30](https://github.com/VeryComplexAndLongName/OpenSpec-UI/pull/30).
- [x] 7.2 CI green (all four checks, including the new `openspec-validate`
  merge-gate job running for real in GitHub Actions for the first time),
  then merged as `f5bfaee` into `main`.
