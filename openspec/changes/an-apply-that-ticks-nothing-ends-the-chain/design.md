## Context

`HarnessChainRunner` captures a checkpoint of the working directory around
`apply` and counts ticked tasks before it. Since a-done-task-is-ticked, an
`apply` that changed files and ticked no task is named on the timeline and
the chain goes on: the work may be fine and only the ticks missing, and
`verify` may tick what it confirms. An `apply` that changed nothing is not
mentioned at all, and the chain goes on to `verify` and `archive`.

## Decisions

1. **What counts as doing nothing.** The stage completed; the checkpoint was
   read and holds no change; the number of ticked tasks did not grow; and
   at least one task is still open that the implementing agent is meant to
   do - not marked **Human-only** and not delegated to another agent. A
   change whose only open tasks wait on a person or another agent has
   nothing for `apply` to do, and its chain goes on as before.
2. **Stop, as failed.** The chain ends with `failed`, before the checkpoint
   that would ask to continue to `verify`. The reason says the stage changed
   no file and ticked no task, names up to five open tasks as the archive
   refusal does, and says what to do: look at the run's reply and its
   questions, then start the change again. A failure, not a cancel: the
   stage did not do what it was run for.
3. **Unchanged where it cannot be known.** A checkpoint that could not be
   captured or read decides nothing, and a task list that cannot be read
   decides nothing; the chain goes on as it did.
4. **Files changed, nothing ticked, stays as it was.** That case keeps its
   decision from a-done-task-is-ticked: named, and the chain goes on.

## Risks / Trade-offs

- **An agent that did the work outside the working directory** (for example
  only in a remote service) and ticked nothing now stops the chain. It also
  ticked nothing, so `archive` would have refused it anyway; it now stops
  two stages earlier, and says why.
- **`maxStageAttempts` is not used to repeat such an apply.** Running the
  same stage again on the same files and answers is unlikely to differ; the
  operator decides, with the reason in front of them.
