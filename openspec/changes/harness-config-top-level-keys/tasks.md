The instance behind this change was found by running the repository's own
file through the real reader, not by reading the code. Do the same at the
end: a validator that rejects a fixture while the real files still load
wrong proves nothing.

## 1. The check

- [ ] 1.1 `packages/core/src/harness-config.ts`,
  `assertValidHarnessConfigInput`: a top-level key the schema does not
  define is refused, naming the unknown key and listing the accepted set
  — `stepAgents`, `autonomyLevel`, `reviewGate`, `checkpoints`,
  `budget`, `gitStageAllowlist`.
- [ ] 1.2 Same function: the accepted set is derived from one place, not
  written twice. A key added to `HarnessConfig` without being added here
  would be refused on every file that used it, which is a worse failure
  than the one this change fixes.
- [ ] 1.3 The check applies to both the global
  `openspec/agent-harness.json` and a per-change `harness.json`. Both go
  through this function already; do not add a second path.
- [ ] 1.4 It runs **before** the existing per-key checks, so a file with
  both problems reports the unknown key rather than a confusing message
  about a key the author did not mean to write.
- [ ] 1.5 Do **not** rewrite a misplaced key into the shape it probably
  meant. See design.md — a configuration that quietly does something its
  author did not write is what this change removes, not a recovery to
  perform.
- [ ] 1.6 Where the unrecognized key is a stage name (`propose`,
  `review`, `apply`, `verify`, `archive`, `git`), the message may name
  `stepAgents.<key>` as a possibility. Phrase it as a question, not an
  assertion — design.md's open question, resolved this way unless review
  disagrees.

## 2. Tests

- [ ] 2.1 `harness-config.test.ts`: a global file and a per-change file
  each carrying an unknown top-level key produce an error naming the key
  and the accepted set.
- [ ] 2.2 Same file: the exact shape found in this repository —
  `{"apply": {"agent": "claude-cli", "dispatch": "vscode-chat"}}` with no
  `stepAgents` wrapper — is refused, and the message mentions
  `stepAgents.apply`. This is the case that motivated the change; assert
  it literally.
- [ ] 2.3 Same file: every valid configuration still loads. Assert
  against the real `openspec/agent-harness.json`, not a fixture — the
  same guard `harness-config-strictness` task 6.4 needed, and the same
  one that passed vacuously there for days by resolving a path one level
  above the repository. Check the path.
- [ ] 2.4 Same file: a file that is valid apart from one unknown key
  reports **that** key, not a downstream complaint about something else.
- [ ] 2.5 Same file: a legacy `dispatch` inside a correctly-wrapped
  `stepAgents` still migrates and still warns. This change must not
  reach the migration.

## 3. Verification

- [ ] 3.1 `openspec change validate --strict harness-config-top-level-keys`.
- [ ] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all four workspaces.
- [ ] 3.3 Run every `harness.json` under `openspec/changes/` and the
  global `openspec/agent-harness.json` through `readChangeHarnessConfig`
  / `readGlobalHarnessConfig` and confirm each still loads. This is how
  the defect was found, and it is the only check that speaks for the
  files that actually exist.
- [ ] 3.4 `git diff` on `harness-step-agent.ts`, `default-runners.ts` and
  `packages/core/src/agents/` is **empty**. This change is about which
  keys a file may carry, nothing else.
- [ ] 3.5 Version bump via `npx changeset` (`@openspec-ui/core` minor).
- [ ] 3.6 **Human-only, cannot be completed by an implementing agent**:
  write a `harness.json` with a stage at the top level, as the deleted
  file had it, and confirm the run refuses it with a message naming the
  key — rather than starting and behaving as though the file were not
  there.
