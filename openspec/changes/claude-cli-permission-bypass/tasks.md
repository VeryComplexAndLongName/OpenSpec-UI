## 1. Fix

- [x] 1.1 `packages/core/src/agents/claude.ts`: `buildInvocation()`
  returns `args: ["-p", "--output-format", "text",
  "--dangerously-skip-permissions"]`.
- [x] 1.2 `packages/core/src/default-runners.ts`: `claude-cli`'s
  allowlist entry becomes `exact(["-p", "--output-format", "text",
  "--dangerously-skip-permissions"])`.

## 2. Tests

- [x] 2.1 `claude.test.ts`: updated every existing assertion on
  `buildInvocation()`'s args to include `--dangerously-skip-permissions`.
- [x] 2.2 `default-runners.test.ts` asserts the allowlist shape
  dynamically against each adapter's real `buildInvocation()` output —
  no hardcoded shape to update; its separate "rejects a mismatched
  shape" test already used a different, still-invalid arg combination
  unaffected by this change.

## 3. Verification

- [x] 3.1 `openspec change validate --strict
  claude-cli-permission-bypass` — passes.
- [x] 3.2 typecheck/lint/test for `core` — green (263 tests; 2 unrelated
  pre-existing failures in `sprint-report.test.ts`, a Windows temp-dir
  EBUSY/cleanup race unconnected to this change).
- [x] 3.3 Live verification: real `claude -p --output-format text` run
  (via `cross-spawn`, matching the adapter's exact invocation) in an
  isolated scratch directory, asked to create one file. Without
  `--dangerously-skip-permissions`: `"I don't have permission to write
  to that file..."`, no file created — reproduces the exact reported
  bug. With it: file created successfully. Both runs compared directly,
  not assumed.
- [x] 3.4 `openspec/specs/execution-core/spec.md` delta.
- [x] 3.5 Version bump via `npx changeset` (`@openspec-ui/core`, patch)
  — `.changeset/claude-cli-permission-bypass.md` added.
