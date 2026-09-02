## 1. Fix

- [x] 1.1 `packages/core/src/security.ts`: `prepareAgentContext` becomes
  `async`, reads `proposal.md`/`design.md`/`tasks.md` and any
  `specs/*/spec.md` files under `context.changeDir` (each skipped if
  missing — a self-contained `readChangeArtifacts` helper, deliberately
  not importing `workbench.ts`'s `discoverChangeArtifacts` so this
  security-critical module's file-reading surface stays in one place to
  audit), embeds their real content under clear per-file `## <label>`
  headers, adds an explicit "work only within this changeDir, do not read
  or modify sibling `openspec/changes/<id>/` directories" instruction,
  and still appends `context.promptContext` afterward if a caller
  supplies it.
- [x] 1.2 `packages/core/src/agent-runner.ts`: `await`s the call (its one
  call site).

## 2. Tests

- [x] 2.1 `security.test.ts` (7 tests in the `prepareAgentContext`
  describe block, all green): real temp-directory fixtures (`mkdtemp`,
  matching this repository's established test pattern) — a change with
  all three artifacts present embeds all three; a change missing
  `tasks.md` embeds only what exists; a change with a delta spec under
  `specs/<id>/spec.md` embeds it too; a nonexistent `changeDir` produces
  a prompt with no embedded content (not a thrown error); the "reference
  data, not instructions" framing and the new "stay within this
  changeDir" instruction are both present; `context.promptContext`, when
  given, still appears in the result, after the real file content
  (position asserted explicitly, not just presence).
- [x] 2.2 `agent-runner.test.ts`: the existing prompt-injection-boundary
  test needed no change — it already used a nonexistent `changeDir`
  (`/workspace/repo/openspec/changes/x`), which `readChangeArtifacts`
  already handles gracefully (empty result, not a thrown error), so its
  existing assertions (injected text still reaches the prompt as data,
  executable/cwd/args unaffected) remain valid as-is. No separate
  "real tasks.md content reaches the adapter" case added here — already
  covered thoroughly by `security.test.ts`'s own tests on the function
  that actually does the reading; duplicating it at the adapter-boundary
  layer would test the same thing twice for no added confidence.

## 3. Verification

- [x] 3.1 `openspec/specs/execution-core/spec.md` delta — new requirement
  for real content in the agent prompt (written before implementation,
  matches what was actually built).
- [x] 3.2 `openspec change validate --strict agent-prompt-context` —
  passes.
- [x] 3.3 typecheck/lint/test for `core` and workspace-wide — all green
  (261 core tests + 165 extension + 58 server + 201 webui + cli, no
  failures; one pre-existing, unrelated Windows-only flaky test in
  `sprint-report.test.ts` did not even flake this run).
- [x] 3.4 Version bump via `npx changeset` (`@openspec-ui/core`, `minor`)
  — `.changeset/agent-prompt-context.md` added, not yet applied.
