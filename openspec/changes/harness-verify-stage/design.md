## Context

See `proposal.md` and `docs/adr/0018-event-driven-harness-orchestration.md`
(gap 1, decision 3). Load-bearing facts, established by reading the code
rather than recalled:

- `CHAIN_STAGES = ["propose", "review", "apply", "archive"]` and the chain
  is executed as `CHAIN_STAGES.slice(CHAIN_STAGES.indexOf(startStage))` —
  a linear walk with no revisiting.
- `commandInstruction("review")` already reads "Review the current
  implementation of the change described below against the specification",
  which is false at position 2.
- `HarnessStage` is `"propose" | "review" | "apply" | "archive" | "git"`,
  declared in `harness-stage.ts` — a leaf module with no Node imports,
  because it is re-exported as a value through
  `@openspec-ui/core/browser`.
- `GitWrapper.diff(pathspec?)` exists (`packages/core/src/git.ts`).
- `checkpoint.ts` snapshots the workspace before a mutating run and
  computes a `CheckpointDelta[]` of `{ path, kind, beforeHash, afterHash }`
  against an `after` scan, with file contents held in both snapshots.
- The archive gate added by `harness-chain-archive-gate` already refuses to
  archive a change whose `tasks.md` has unchecked tasks, and fails safe
  when task counts cannot be read.

## Goals / Non-Goals

**Goals:**

- Put a stage after `apply` that examines what was produced, with its own
  configurable agent.
- Give that stage the one thing it cannot work without: what the run
  actually changed.
- Resolve the standing contradiction between the `review` stage's position
  and its own instruction text.

**Non-Goals (this change):**

- The loop back to `apply`, the iteration cap, and `needsRedesign` —
  `harness-review-loop`.
- Any edge back to `propose` — ADR 0018 decision 4.
- Changing the archive gate, the event protocol, or any adapter.
- Claiming this replaces human review or the live smoke test. See Risks.

## Decisions

### `verify` is its own `CommandKind`, and `review`'s wording is corrected

Rather than reusing `review` at a second position, `verify` is added as an
additive `CommandKind` with its own instruction, and `review`'s instruction
is reworded to describe reviewing a proposal.

**Rejected alternative**: reuse `review` for both positions. Rejected — the
same kind would mean two different jobs depending on where in the chain it
appeared, and `commandInstruction()` takes only the kind, so it could not
tell them apart. That is exactly the ambiguity that produced today's
contradiction; reusing the kind would freeze it in place.

**Rejected alternative**: move `review` to position 4 and drop the
proposal review. Rejected — reviewing a proposal before implementing it is
worth keeping on its own merits, and removing it would silently change
what existing `stepAgents.review` configurations do.

### The verifier is given the run's own delta, not `git diff`

The stage's prompt carries what the verified run changed, sourced from the
checkpoint's before/after snapshots (`CheckpointDelta` plus content), not
from `GitWrapper.diff()`.

**Rejected alternative**: `GitWrapper.diff()`. Rejected — it reports the
whole dirty working tree. Throughout this project's own development a
second session has had uncommitted work in the same tree; a tree-scoped
diff would put that session's unrelated changes into a verifying agent's
prompt, and the agent would review work nobody asked it about. The
checkpoint delta is scoped to one run, which is the actual question being
asked.

Honest limit: the checkpoint delta is *time*-scoped, not
*ownership*-scoped, so concurrent edits during the run still land in it.
Worktree isolation (ADR 0004 decision 4) is what makes it exact; until
then this is narrower than `git diff`, not perfect.

### An oversized delta is truncated with a marker, never silently dropped

Where the delta does not fit the prompt, it is truncated and the prompt
says so explicitly, naming how many files were omitted.

**Rejected alternative**: omit the delta when it is large. Rejected — a
verifier that silently receives no diff reviews from `tasks.md` alone and
reports confidently on work it never saw. A visible truncation marker lets
it say what it could not check.

This stage is a first-class beneficiary of ADR 0013's argv finding: a
raw-text `copilot-cli` prompt is capped at `MAX_ARGV_PROMPT_LENGTH = 6000`
and falls back to naming the change directory, which for this stage means
no diff at all. Over ACP the prompt travels in a `session/prompt` message
with no such cap. Until then, truncation is the honest behavior.

### The verifier's output is edits to `tasks.md`, and the existing gate does the stopping

A verifier that finds an overstated task unchecks it. The archive gate
already refuses to archive a change with unchecked tasks, so the chain
stops with no new outcome kind, no new event, and no new gate.

**Rejected alternative**: a new terminal outcome for "verification found
problems" in this change. Rejected — that is `needsRedesign` and belongs
with the loop that consumes it (ADR 0018 decision 3). Adding a terminal
kind with no consumer would oblige every switch over terminal kinds to
handle a case that cannot yet occur.

## Risks / Trade-offs

- **[Risk]** A verifying agent reading a diff would not have caught this
  project's two worst defects. `harness-prompt-project-rules`'s defect was
  invisible in the diff — the code looked correct, and only running the
  real CLI and reading its output exposed it; `harness-step-models`'s value
  was dropped at a layer where types and tests both passed. →
  **Mitigation**: none available, and none claimed. This stage filters the
  cheap layer (a task not done, a test not written, a diff that does not
  match the task). Human-only tasks stay human-only, per `rules.tasks`.
  The specification must not describe this stage as sufficient.
- **[Risk]** A verifier could uncheck tasks that were in fact done,
  sending a later loop back over finished work. → **Mitigation**: in this
  change there is no loop, so the cost is bounded at a stopped chain and a
  human looking. The iteration cap arrives with the loop that creates the
  risk.
- **[Trade-off]** One more agent run per chain, with its cost. Accepted;
  `agent-usage-accounting` is what makes that cost visible, and a budget
  bounds it.

## Migration Plan

Additive. `stepAgents.verify` unset resolves the same way every other unset
stage entry does today, so existing global and per-change `harness.json`
files keep working with no edit. A chain that was mid-flight before this
change resumes through `determineStartStage()` as before; `verify` is
simply a stage it had not reached.

## Open Questions

None. The loop, the iteration cap and the `propose` edge are all deferred
to `harness-review-loop` by ADR 0018 rather than left open here.
