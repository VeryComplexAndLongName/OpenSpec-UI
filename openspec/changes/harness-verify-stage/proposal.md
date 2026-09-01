## Why

`docs/adr/0018-event-driven-harness-orchestration.md`, gap 1: no stage
reviews an implementation. `HarnessChainRunner`'s `CHAIN_STAGES` is
`["propose", "review", "apply", "archive"]`, so `review` runs at position 2
— before anything is implemented. After `apply`, nothing examines what was
produced except the archive gate's task-count check, which is mechanical.

The codebase already contradicts itself about this.
`packages/core/src/agents/shared.ts`'s `commandInstruction("review")` reads
"Review the current implementation of the change described below against
the specification" — a sentence that is only true at position 4. Both
readings are live at once: the stage order says "review the proposal", the
instruction says "review the implementation".

The gap is not theoretical. On 2026-09-01, `harness-prompt-project-rules`
was implemented through the harness, marked 17/18, and passed every unit
test and a clean typecheck — and was wrong: it fed the implementing agent a
prompt whose first block said "Create the tasks artifact", because the CLI
command it called returns the *authoring* prompt for an artifact rather
than the rules for carrying it out. A human review caught it; nothing in
the chain could have. The same session's `harness-step-models` required
three rounds for a related reason.

ADR 0018 also fixes what this change may not do: the `apply ⇄ verify` loop
and the `needsRedesign` outcome belong to `harness-review-loop`. This
change adds the stage and stops there, because a stage that reports has
value on its own — the existing archive gate already refuses to archive a
change with unchecked tasks, so a verifier that unchecks an overstated task
stops the chain using machinery that already exists.

## What Changes

- `packages/core/src/protocol.ts`: additive `CommandKind` member `verify`.
  Existing members and their behavior are unchanged, per ADR 0012's
  precedent for additive protocol growth.
- `packages/core/src/agents/shared.ts`: `commandInstruction("verify")`
  instructs a review of the implementation against `tasks.md` and the
  change's spec delta, and to uncheck any task whose stated verification
  does not actually hold. `commandInstruction("review")` is reworded to
  describe what it actually does at position 2 — review the *proposal* —
  resolving the contradiction above.
- `packages/core/src/harness-stage.ts`: `HarnessStage` gains `"verify"`;
  `STAGES` gains it in chain order.
- `packages/core/src/harness-chain-runner.ts`: `CHAIN_STAGES` becomes
  `["propose", "review", "apply", "verify", "archive"]`;
  `CHAIN_STAGE_COMMAND` maps `verify` to the new `CommandKind`.
- `packages/core/src/security.ts`: a `verify` command's prompt additionally
  carries what the run being verified actually changed.
- `packages/core/src/harness-config.ts`: `stepAgents` accepts a `verify`
  entry, resolved and validated exactly as the existing five are.

## Capabilities

### New Capabilities

(none — this extends `agentic-harness` and `execution-core`)

### Modified Capabilities

- `agentic-harness`: the chain gains a stage that reviews the
  implementation after `apply`, with its own configurable agent.
- `execution-core`: an additive `verify` command kind, and a prompt that
  can carry a run's own changes.

## Impact

- `packages/core`: `protocol.ts`, `agents/shared.ts`, `harness-stage.ts`,
  `harness-chain-runner.ts`, `harness-config.ts`, `security.ts`.
- `packages/extension`, `packages/webui`: the exhaustive switches over
  `CommandKind` that every previous additive protocol change has had to
  widen (`describe-event.ts`, `AiPanel.tsx`'s `describeEvent()`).
- No change to any agent adapter, to `spawnAndStream`, or to the event
  protocol — `verify` is a command kind, not an event kind.

## Explicitly out of scope

- The `apply ⇄ verify` loop, its iteration cap, and the `needsRedesign`
  outcome — `harness-review-loop`, per ADR 0018 decisions 3 and 4.
- Any edge back to `propose`. ADR 0018 decision 4 requires that edge to be
  human-gated at every autonomy level, and it does not exist yet.
- Changing the archive gate. It already refuses to archive a change with
  unchecked tasks, which is precisely the stop this change relies on.
