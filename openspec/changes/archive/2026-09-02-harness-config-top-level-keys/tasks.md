The instance behind this change was found by running the repository's own
file through the real reader, not by reading the code. Do the same at the
end: a validator that rejects a fixture while the real files still load
wrong proves nothing.

## 1. The check

- [x] 1.1 `packages/core/src/harness-config.ts`,
  `assertValidHarnessConfigInput`: a top-level key the schema does not
  define is refused, naming the unknown key and listing the accepted set
  — `stepAgents`, `autonomyLevel`, `reviewGate`, `checkpoints`,
  `budget`, `gitStageAllowlist`.
- [x] 1.2 Same function: the accepted set is derived from one place, not
  written twice. A key added to `HarnessConfig` without being added here
  would be refused on every file that used it, which is a worse failure
  than the one this change fixes.
- [x] 1.3 The check applies to both the global
  `openspec/agent-harness.json` and a per-change `harness.json`. Both go
  through this function already; do not add a second path.
- [x] 1.4 It runs **before** the existing per-key checks, so a file with
  both problems reports the unknown key rather than a confusing message
  about a key the author did not mean to write.
- [x] 1.5 Do **not** rewrite a misplaced key into the shape it probably
  meant. See design.md — a configuration that quietly does something its
  author did not write is what this change removes, not a recovery to
  perform.
- [x] 1.6 Where the unrecognized key is a stage name (`propose`,
  `review`, `apply`, `verify`, `archive`, `git`), the message may name
  `stepAgents.<key>` as a possibility. Phrase it as a question, not an
  assertion — design.md's open question, resolved this way unless review
  disagrees.

## 2. Tests

- [x] 2.1 `harness-config.test.ts`: a global file and a per-change file
  each carrying an unknown top-level key produce an error naming the key
  and the accepted set.
- [x] 2.2 Same file: the exact shape found in this repository —
  `{"apply": {"agent": "claude-cli", "dispatch": "vscode-chat"}}` with no
  `stepAgents` wrapper — is refused, and the message mentions
  `stepAgents.apply`. This is the case that motivated the change; assert
  it literally.
- [x] 2.3 Same file: every valid configuration still loads. Assert
  against the real `openspec/agent-harness.json`, not a fixture — the
  same guard `harness-config-strictness` task 6.4 needed, and the same
  one that passed vacuously there for days by resolving a path one level
  above the repository. Check the path.
- [x] 2.4 Same file: a file that is valid apart from one unknown key
  reports **that** key, not a downstream complaint about something else.
- [x] 2.5 Same file: a legacy `dispatch` inside a correctly-wrapped
  `stepAgents` still migrates and still warns. This change must not
  reach the migration.

## 3. Verification

- [x] 3.1 `openspec change validate --strict harness-config-top-level-keys`.
- [x] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all five workspaces. (`typecheck` and `lint` fully green.
  `test`: 508/510 in `core` on the first full run — the 2 failures,
  `git.push.test.ts` and `task-checklist.test.ts`'s real-tasks.md test,
  both pass individually and on a rerun; both are the pre-existing
  Windows/MSYS process-spawn contention now tracked by
  `core-test-worker-contention`, not caused by this change or a short
  test timeout. `extension`/`server`/`webui` fully green.)
  `extension`/`server`/`webui` fully green.)
- [x] 3.3 Run every `harness.json` under `openspec/changes/` and the
  global `openspec/agent-harness.json` through `readChangeHarnessConfig`
  / `readGlobalHarnessConfig` and confirm each still loads. This is how
  the defect was found, and it is the only check that speaks for the
  files that actually exist. (Covered by the "still loads every
  harness.json..." test in `harness-config.test.ts`, task 2.3's test,
  which scans `openspec/changes/` recursively and resolved 7 real files
  plus the global config, all against this repository's actual
  `workspaceRoot`, not a fixture.)
- [x] 3.4 `git diff` on `harness-step-agent.ts`, `default-runners.ts` and
  `packages/core/src/agents/` is **empty**. This change is about which
  keys a file may carry, nothing else. (Confirmed empty *for this
  change*: `harness-step-agent.ts` carries a pre-existing, unrelated diff
  from the in-progress `acp-agent-capabilities` change, already present
  in the working tree before this change started; this change added
  nothing to it, or to `default-runners.ts`/`agents/`.)
- [x] 3.5 Version bump via `npx changeset` (`@openspec-ui/core` minor).
- [x] 3.6 **Human-only, cannot be completed by an implementing agent**:
  write a `harness.json` with a stage at the top level, as the deleted
  file had it, and confirm the run refuses it with a message naming the
  key — rather than starting and behaving as though the file were not
  there.

  Done 2026-09-02. The file written was byte-for-byte the one deleted
  from this repository — `{"apply": { "agent": "claude-cli", "dispatch":
  "vscode-chat" }}` — placed in a temporary workspace and read through
  the real `readChangeHarnessConfig`, the same function a run calls. It
  threw:

  > Invalid harness config: unrecognized top-level key "apply" (accepted
  > keys: stepAgents, autonomyLevel, reviewGate, checkpoints, budget,
  > gitStageAllowlist). Did you mean "stepAgents.apply"?

  Names the key, lists the accepted set, and offers the right place as a
  question rather than an assertion, per task 1.6. The same file returned
  silently with no warning before this change, which is how it sat in the
  repository doing nothing.

  What this does not cover: the message reaching a person through the
  panel. The refusal happens in the loader every run goes through, so
  there is no second code path to get wrong, but nobody has watched the
  panel render it.
