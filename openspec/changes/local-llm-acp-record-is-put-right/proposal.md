# Put the `local-llm-acp` record right

## Why

`local-llm-acp` landed on 2026-10-01 in #803 (`5b6e8383`) with every box
ticked, and it is still sitting in `openspec/changes/`. It will stay
there: no amount of waiting archives it.

[ADR 0035](../../../docs/adr/0035-a-landed-change-is-archived-for-you.md)
has the workspace sweep archive a change that has landed owing nothing,
and "owing nothing" is one answer every reader takes — the sweep and the
merge gate alike — so that "finished" cannot mean two things. That answer
is `owesNothing(describeTaskDebts(...))` in `packages/core`, and for this
change it is `false`.

The item at fault is 4.4, `**Delegated to local-llm-acp**`. Its record —
the run id, the agent's version, the tool calls, the outcome — is real
and was written. It was written *on the checkbox line itself*, with
nothing indented beneath it. `isUnrecordedTask` reads a delegated item as
unrecorded when the lines continuing it are empty, whatever is on the
line, because nothing can mechanically tell a record appended to an
item's sentence from the item's own instructions. So the rule sees a
delegated item that claims a run and writes nothing, and holds the change
open.

Measured on 2026-10-02, at `513a5c96`:

- `describeTaskDebts` over the file reports `open: []` and
  `unrecorded: ["4.4 ..."]`, so `owesNothing` is `false`.
- The merge gate, run the way CI runs it but with this change named —
  `validate --change local-llm-acp` — returns `"ok": false` and lists 4.4
  under `unrecordedItems`.

**Why it landed anyway.** The gate takes `--change "$GITHUB_HEAD_REF"`,
and the branch was named `fix-local-llm-acp` rather than `local-llm-acp`.
A name no active change has is skipped rather than guessed at
(`openspec-validate.ts`), so the debt check never ran. The gate was green
having checked nothing. The pull request's *title* was the change id; the
branch was not, and it is the branch the gate reads.

## What Changes

- 4.4's record moves to the lines under its checkbox, word for word.
  Nothing is re-verified and nothing is reworded: the run happened, and
  only where it is written was wrong.
- `openspec/README.md` says where a delegated or human-only record goes,
  and that the branch carries the change id because the merge gate reads
  the branch — the half of "one change is one pull request" that was
  implicit until it cost this change its archiving.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `openspec-workbench`: a delegated or human-only item's record is
  written under the item, where the rule that closes the item reads it.

## Impact

- `openspec/changes/local-llm-acp/tasks.md` and `openspec/README.md`.
- No source changes, no behaviour changes, no changeset.
- After this lands, the sweep archives `local-llm-acp` on its next pass.

## Explicitly out of scope

- **Teaching the rule to count a record on the checkbox line.** Nothing
  mechanically separates "record evidence in this task" from the evidence
  appended after it; the indented block is the deliberate proxy for
  "somebody came back and wrote this", and every other recorded item in
  this repository already uses it. Loosening the rule to accept a long
  line would close items that say a great deal and record nothing.
- **Making the merge gate check every change whose `tasks.md` a pull
  request touches.** It would have caught this one. It would also fail a
  pull request that legitimately carries another change's freshly opened
  proposal, whose items are all open by design. That is a rule with its
  own blast radius and belongs in its own change, decided on purpose
  rather than as a side effect of a record correction.
- **Re-running 4.4's verification.** The run is recorded with its id and
  its outcome, and re-running it would prove nothing the record does not
  already state.
- **Auditing the bookkeeping of other changes.** `local-llm-acp` is the
  only other change active in this repository; there is no backlog here
  to sweep.
