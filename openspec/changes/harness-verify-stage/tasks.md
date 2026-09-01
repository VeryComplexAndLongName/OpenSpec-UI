Path this change must hold end to end: `CHAIN_STAGES` → `runStage`'s
`CHAIN_STAGE_COMMAND[stage]` → the `Command` → `prepareAgentContext` →
the spawned agent's prompt. A new stage that reaches the agent without its
delta is the failure this ordering exists to prevent — check each junction,
not only the two ends.

## 1. Protocol

- [ ] 1.1 `packages/core/src/protocol.ts`: add `"verify"` to `CommandKind`
  and to `COMMAND_KINDS`. Additive only — do **not** change any existing
  member or its behavior. No new `EventKind`: `verify` is a command, not
  an event.
- [ ] 1.2 `packages/core/src/agents/shared.ts`,
  `commandInstruction()`: add a `case "verify"` instructing the agent to
  review the implementation against `tasks.md` and the change's
  `specs/*/spec.md` delta, and to uncheck any task whose stated
  verification does not actually hold.
- [ ] 1.3 Same function: reword `case "review"` so it describes reviewing
  the change's **proposal** (`proposal.md`/`design.md`/`tasks.md`), not
  "the current implementation". That sentence is false at the position the
  stage actually runs — see design.md's Context.
- [ ] 1.4 `packages/core/src/protocol.test.ts`: `COMMAND_KINDS` contains
  `"verify"`, and every previously present kind is still present with its
  existing behavior.

## 2. Stage wiring

- [ ] 2.1 `packages/core/src/harness-stage.ts`: add `"verify"` to
  `HarnessStage` and to `STAGES`, positioned between `"apply"` and
  `"archive"`. This module must keep **zero non-type imports** — it is
  re-exported as a value through `@openspec-ui/core/browser`, and
  `packages/server/src/static.test.ts`'s esbuild check enforces it.
- [ ] 2.2 `packages/core/src/harness-chain-runner.ts`: `CHAIN_STAGES`
  becomes `["propose", "review", "apply", "verify", "archive"]`.
- [ ] 2.3 Same file: `CHAIN_STAGE_COMMAND` gains `verify: "verify"`. Its
  type currently covers only `"propose" | "review" | "apply"` — widen it to
  include `"verify"`, and do **not** widen it to `"archive"`, which is not
  an agent run.
- [ ] 2.4 Same file: `determineStartStage()` must return `"verify"` for a
  change whose tasks are all checked but which is not yet archived, in
  place of today's `"archive"`. Keep the existing fail-safe: unknown task
  counts still pick the reversible stage.
- [ ] 2.5 `packages/core/src/harness-config.ts`: `stepAgents` accepts a
  `verify` entry, resolved, merged and validated exactly as the existing
  entries are. Do **not** add a new validation rule for it.

## 3. The delta in the prompt

- [ ] 3.1 `packages/core/src/security.ts`: `AgentPromptContextOptions`
  gains an optional field carrying the verified run's changed files as
  `{ path, kind, before?, after? }`. Reuse `CheckpointDelta`'s vocabulary
  (`added`/`modified`/`deleted`); do not invent a second one.
- [ ] 3.2 Same file: when that field is present, `prepareAgentContext()`
  adds a labelled section carrying it, distinct from both the rules
  section and the change-content body. When absent, the prompt is
  byte-identical to today's.
- [ ] 3.3 Same file: do **not** call `GitWrapper.diff()` from here or
  anywhere on this path. A tree-scoped diff would put a concurrent
  session's unrelated uncommitted work into a verifying agent's prompt —
  see design.md's rejected alternative.
- [ ] 3.4 Same file: when the delta exceeds the section's size budget,
  truncate it and state in the prompt how many files were omitted. Do
  **not** drop it silently — a verifier that receives no diff reviews from
  `tasks.md` alone and reports confidently on work it never saw.
- [ ] 3.5 `packages/core/src/harness-chain-runner.ts`: the `verify` stage
  passes the delta of the `apply` run that preceded it. Where no delta is
  available (no checkpoint, or a resumed chain that did not run `apply`),
  pass none — task 3.2's absent-field path already produces today's
  prompt.

## 4. Transport and UI switches

- [ ] 4.1 `packages/extension/src/describe-event.ts`: handle the `verify`
  command kind in its exhaustive switch, the same widening every previous
  additive protocol change performed.
- [ ] 4.2 `packages/webui/src/components/AiPanel.tsx`, `describeEvent()`:
  the same.
- [ ] 4.3 `packages/extension` and `packages/webui`: wherever a stage list
  is presented to a user, `verify` appears in chain order. No new business
  logic in either package, per ADR 0001.

## 5. Tests

- [ ] 5.1 `harness-chain-runner.test.ts`: a chain runs `verify` between
  `apply` and `archive`, using `stepAgents.verify`'s agent when set and the
  default agent when unset.
- [ ] 5.2 `harness-chain-runner.test.ts`: `determineStartStage()` returns
  `"verify"` for a change with all tasks checked and no archive, and still
  returns `"apply"` when task counts cannot be read.
- [ ] 5.3 `security.test.ts`: with a delta supplied, the `verify` prompt
  contains the changed paths in their own section, distinct from the rules
  and change-content sections; with none supplied, the prompt is
  byte-identical to today's.
- [ ] 5.4 `security.test.ts`: an oversized delta produces a truncated
  section that states the number of omitted files, and never an empty or
  absent section.
- [ ] 5.5 `harness-config.test.ts`: `stepAgents.verify` resolves through
  the same global/per-change merge as the other entries; an unset entry
  behaves exactly as an unset `review` does today.
- [ ] 5.6 A test asserting the chain still stops before `archive` when
  `verify` leaves unchecked tasks behind — the existing archive gate does
  this, and this test is what proves this change relies on it rather than
  duplicating it.

## 6. Verification

- [ ] 6.1 `openspec change validate --strict harness-verify-stage`.
- [ ] 6.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all four workspaces. `sprint-report.test.ts` and
  `change-timeline.test.ts` have pre-existing Windows timeout flakes at
  5000 ms under load; do not attempt to fix them here.
- [ ] 6.3 `packages/server/src/static.test.ts`'s esbuild browser-bundle
  check stays green — task 2.1's constraint on `harness-stage.ts`.
- [ ] 6.4 `git diff packages/core/src/agents/` shows changes to
  `shared.ts` only. Any adapter file appearing there means the change
  reached further than it should.
- [ ] 6.5 Version bump via `npx changeset` (`@openspec-ui/core` minor,
  plus the packages whose switches changed).
- [ ] 6.6 **Human-only, cannot be completed by an implementing agent**:
  run a real chain on a change whose `tasks.md` overstates one task, and
  confirm from the run's own output that `verify` unchecks it and the
  chain then stops before `archive`. Leave unchecked if you are an agent.
