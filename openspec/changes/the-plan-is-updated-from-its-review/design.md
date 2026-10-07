## Context

`commandInstruction(kind)` in `agents/shared.ts` is the product's own
instruction per command kind, placed before the prompt; `plan` writes only
missing artifacts, `review` reviews the proposal and writes nothing.
`prepareAgentContext` adds sections to a prompt (project rules, verified
delta, operator messages). The audit log keeps each run's `summary` and,
since the-board-and-the-run-read-right, its `command`. The chain's stages
are `propose`, `review`, `apply`, `verify`, `archive`, `git`, each with a
`stepAgents` entry where it runs an agent.

## Decisions

1. **`update` is a command kind, not a chain stage of its own name.** It
   joins `CommandKind` and `COMMAND_KINDS`; every adapter maps it as it maps
   `plan` (a run that writes files in the change's directory and nothing
   else, under the same allowlist).
2. **Its instruction.** "Update the planning artifacts of the change
   described below - proposal.md, the spec deltas, design.md, tasks.md - so
   that they answer the review and the notes given below. Change what they
   ask for and what has to change with it to keep the artifacts coherent;
   leave the rest as it is. Run `openspec instructions <artifact>` before
   changing an artifact, and finish with `openspec validate <name>
   --strict`, correcting until it passes. Do not change code or any file
   outside the change's directory. Say in your reply what you changed and
   which finding or note each change answers, and which you did not act on
   and why."
3. **Its context.** A section "The last review", holding the summary of the
   change's latest completed run whose `command` is `review` or whose
   `stage` is `review`, with its date and agent; "There is no review of
   this change yet" where there is none. A section "The operator's notes"
   with what was written when it was started. Both are data, framed as
   descriptions, the way exploration notes are (one-stage-speaks-openspec).
4. **The review verdict marker.** The review instruction gains: "End your
   reply with a line of its own: `Review verdict: ready` if the plan can be
   implemented as it is, or `Review verdict: changes needed` if anything
   you found should be fixed first." `review-verdict.ts` reads it like
   `task-marker.ts`: leading list or quote marks and emphasis tolerated,
   start of line only, the last one wins. The run's terminal event and its
   audit entry carry `reviewVerdict`.
5. **The chain.** After `review`: `changes needed` starts `update` (a
   `stageStarted` with stage `review` and `updating: true`, so the board,
   the timeline and the budgets keep their six stages), then goes to
   `apply`; `ready` or no verdict goes to `apply`. `stepAgents.update`, an
   optional entry accepted wherever `stepAgents.review` is, names its agent;
   absent, the review's agent runs it. Under `semi-autonomous`, the
   checkpoint after review names the update as the next step.
6. **Surfaces.** AI panel: `update` in the command list with its purpose,
   a "Notes for the update" textarea shown for it, and the last review's
   date named beside it. The card: **Update the plan** where the last run
   was a review with verdict `changes needed`. CLI: `openspec-ui-cli
   update <change> [--note <text>] [--agent <id>] [--cwd <path>]`, printing
   the run as `run` does.

## Risks / Trade-offs

- **An agent may ignore the marker.** The chain then goes on to apply as it
  does today; the panel still offers update by hand.
- **An update may rewrite more than asked.** Its instruction limits it to
  what the findings need, and its reply says what it changed and why.
