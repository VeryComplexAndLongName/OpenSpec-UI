# Design

## Decision: `taskAgents` in the change's own file, not a file per task

The owner proposed a third layer, `agent-<task id>.json`, above
`agent-harness.json` and `harness.json`. Rejected, and they agreed: a
file named after a task outlives the task. Tasks are renumbered,
merged and deleted constantly, and nobody deletes the sidecar — the
directory fills with files each carrying an opinion about a task that no
longer exists, and nothing can tell a stale one from a live one.

A `taskAgents` section inside the change's `harness.json` dies with the
change that owns it, and keeps the merge two levels deep instead of
three. The key is the task's number as written in `tasks.md`:

```json
{ "taskAgents": { "5.4": { "agent": "copilot-cli", "customAgent": "reviewer" } } }
```

Precedence, highest first: `taskAgents`, then the `**Delegated to
<id>**` marker in the task text, then nothing — the item is not
delegated and is not offered a run. Where both exist and disagree, the
file wins and the surface says both, because a disagreement between two
statements about the same task is worth seeing rather than resolving in
silence.

An entry naming a task number that no active line carries is reported,
not ignored: that is the stale-sidecar failure arriving by another
route, and the only defence is to say so.

## Decision: the prompt is the task, not the change

`commandInstruction` covers whole-change kinds — implement, review,
verify. A delegated item is none of those: it is one line of work with
a stated artifact to produce. The prompt states the change it belongs
to, the task's own text verbatim, and the rule the task itself carries:
record the named evidence in the task text, and tick it only with that
evidence present.

The run goes through `createAgentRunner` exactly as a stage does, so
the allowlist, the working-directory sandbox and the audit entry are
the ones already in place. Nothing new is trusted.

## Decision: the rubber-stamp gate is mechanical and narrow

The risk this whole delegation carries is an agent that ticks without
doing the work. Nothing can judge whether written evidence is true.
One thing can be judged: whether the item says anything it did not say
before.

The dispatcher records the task line and its indented body before the
run. Afterwards, if the item became ticked and its text is otherwise
unchanged, the tick is reverted and the run is reported as refused,
naming why. An item that came back ticked with new text is left as the
agent wrote it, for a person to read.

This catches the cheapest failure and claims nothing about the rest.
Said plainly in the surface, so nobody reads a passed gate as a
verified claim.

## Decision: the audit entry says which item

The entry carries the change and the task number, so "what has this
agent been asked to do here" is answerable from the log rather than
from the transcript. It reuses the run shape every other entry has;
`isRunEntry` already says what counts as a run, and a delegated item's
run counts.

## Non-Goals

Running more than one item per invocation. Deciding whether the
evidence is true. Changing what `**Human-only**` means: an item no
agent can close is still offered no run, and that is the distinction
the marking exists for.

## Risks / Trade-offs

The obvious risk is that dispatch makes it easy to spend an agent on
work that was marked for a person by mistake. The marking is the only
guard, and it is a line of text. Mitigated by the gate refusing a
silent tick, and by the run being one item at a time and asked for
deliberately — there is no "run them all".

The second risk is the prompt. A task written as "confirm it works"
gives the agent nothing to produce and everything to claim. That is
already the rule for writing delegated items, and this change makes the
cost of breaking it visible rather than theoretical.
