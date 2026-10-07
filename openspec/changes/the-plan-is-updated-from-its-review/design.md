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
   `apply`; `ready` or no verdict goes to `apply`. The update runs on the
   review stage's agent; a `stepAgents.update` entry was planned and left
   out, since the agent that found the problems is the natural one to answer
   them and a key nobody has asked for is one more rule to learn. Being part
   of the review stage, the update runs before the review's checkpoint
   under `semi-autonomous`, its time and spend count toward the review's,
   and its failure ends the chain (it is not tried again).
6. **Surfaces.** AI panel: `update` in the command list with its purpose,
   a notes textarea shown for it whose label says the update also reads the
   change's last completed review (the review's date, planned here, would
   need the audit log in the panel, which it does not read; the prompt
   gives the agent the review's date and agent).
   The card: **Update the plan** where the last run
   was a review with verdict `changes needed`. CLI: `openspec-ui-cli
   update <change> [--note <text>] [--agent <id>] [--cwd <path>]`, printing
   the run as `run` does.

7. **Found while implementing it, and by the live run (task 4.3).** A process agent such as `copilot
   -p` prints its review and its result carries no summary, so the update
   had no review to read: the runner keeps the last 16 KiB of what a
   completed review said as its audit summary where the result has none.
   An ACP agent asks permission for each tool call, and the CLI's `update`
   left the question unanswered for ever: it now asks at the terminal, as
   `run` asks at a checkpoint, and denies where nobody can be asked. A
   failed update in a chain ended it with no terminal event (`runStage`
   holds a failure for the supervisor): the chain now says it.

## Risks / Trade-offs

- **An agent may ignore the marker.** The chain then goes on to apply as it
  does today; the panel still offers update by hand.
- **An update may rewrite more than asked.** Its instruction limits it to
  what the findings need, and its reply says what it changed and why.
