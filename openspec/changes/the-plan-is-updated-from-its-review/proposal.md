## Why

From a tester's feedback on 2026-10-07: after a `review` that found five
things to fix, nothing in the product could act on them. Running `propose`
again wrote nothing, since every artifact existed, and did not read the
review. "I ran the review, and now I would want to do opsx:update? Or
(again) opsx:propose?" ADR 0041 records the decision.

## What Changes

- A command kind `update` (the product's `opsx:update`): revise the change's
  existing planning artifacts so they answer the last review and the
  operator's notes, keep them coherent, validate strictly, change no code.
- Its prompt carries the latest completed review's result from the audit
  log, and the operator's notes.
- The review instruction asks for a closing marker, `Review verdict: ready`
  or `Review verdict: changes needed`; the product reads it, never prose.
- In a chain, `changes needed` runs `update` before `apply`, once.
- The AI panel, the change's card and the CLI (`openspec-ui-cli update`)
  offer it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `execution-core`: the `update` command kind, its prompt, the review
  verdict marker.
- `agentic-harness`: the chain's update after a review that asks for one;
  `stepAgents.update`.
- `shared-ui`: the AI panel's `update`, with notes; the card's **Update the
  plan**.
- `ci-cli`: `openspec-ui-cli update`.

## Impact

- `packages/core`: `protocol.ts`, `agents/shared.ts` (instructions),
  `security.ts` (prompt section), `review-verdict.ts` (new marker reader),
  `harness-chain-runner.ts`, `harness-step-agent.ts`, `harness-config.ts`,
  and every adapter's command-kind mapping.
- `packages/webui`, `packages/extension`, `packages/server`, `packages/cli`.
- `docs/adr/0041-the-plan-is-updated-from-its-review.md`, `HARNESS.md`.
