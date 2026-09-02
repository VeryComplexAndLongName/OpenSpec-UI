## Why

Found on 2026-09-02 in this repository's own working tree. A per-change
`openspec/changes/harness-stage-dispatch/harness.json` had been sitting
there since the `harness-stage-dispatch` work:

```json
{"apply": { "agent": "claude-cli", "dispatch": "vscode-chat" }}
```

It is missing its `stepAgents` wrapper. Run through the real
`readChangeHarnessConfig`, it comes back unchanged and silent:

```
RESULT {"apply":{"agent":"claude-cli","dispatch":"vscode-chat"}}   WARNINGS []
```

The legacy-dispatch migration looks under `stepAgents` and finds none.
`assertValidStepAgents` never sees the entry for the same reason. The
`apply` key sits at the top level, where nothing reads it. **The chat
dispatch this file was written to enable was never once applied**, and
the file gave no sign of it — not an error, not a warning, not a line in
a log.

This is the same file that prompted the question behind
`harness-config-strictness` — *why does the entry name an agent that is
never used?* That change answered it and fixed a real defect. The answer
underneath turns out to be worse: the agent was not ignored, the entire
file was.

`harness-config-strictness` rejects an unknown key **inside** a stage
entry, and its task 3.4 deliberately declined to extend that to the top
level, to avoid mixing a targeted fix with a sweep. That was the right
call at the time. This is the first real instance of exactly what was
deferred, and the deferral has now cost one silently ineffective
configuration.

The failure is worse at this level than one level down, for two reasons.
A misspelled key inside a stage entry loses one setting; a misplaced or
misspelled key at the top level loses the whole file's effect. And a
per-change `harness.json` is written by hand, rarely, usually to do
something unusual for one change — which is exactly when a person is
least able to tell from the run's behaviour that their file did nothing.

## What Changes

- `packages/core/src/harness-config.ts`: a configuration file carrying a
  top-level key the schema does not define is **refused**, naming the
  unknown key and listing the accepted ones. `stepAgents`,
  `autonomyLevel`, `reviewGate`, `checkpoints`, `budget`,
  `gitStageAllowlist` are the accepted set.
- The same rule applies to both files — the global
  `openspec/agent-harness.json` and a per-change `harness.json` — since
  both are read by the same validator and both can be written wrong the
  same way.
- The refusal happens where the existing ones do, when the configuration
  resolves, so a bad file fails before a run starts rather than by
  producing a run that quietly did something else.

## Capabilities

### New Capabilities

(none — this extends `agentic-harness`)

### Modified Capabilities

- `agentic-harness`: an unrecognized key at the top level of a harness
  configuration file is an error, as it already is inside a stage entry.

## Impact

- `packages/core/src/harness-config.ts` and `harness-config.test.ts`.
- Any workspace whose harness file carries an unrecognized top-level key
  will now fail to load rather than silently ignoring it. That is the
  point, and the migration section of design.md says what to do about
  the one case that is not a typo.

## Explicitly out of scope

- Validating the **contents** of `autonomyLevel`, `reviewGate`,
  `checkpoints`, `budget` or `gitStageAllowlist` beyond what each
  already enforces. This change is about which keys exist, not what is
  inside them.
- Rewriting a misplaced entry into the shape the author meant. A file
  whose `apply` sits at the top level might have meant `stepAgents.apply`
  — or might be a fragment of something else. Guessing is how a
  configuration ends up doing something its author did not write; the
  error names the problem and stops.
