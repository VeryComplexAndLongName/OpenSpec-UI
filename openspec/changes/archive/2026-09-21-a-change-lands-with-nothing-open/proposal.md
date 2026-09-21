## Why

`a-run-budget-has-a-unit` merged at 11:20 with item 4.3 open. It was a
**Human-only** item - whether a ceiling per unit reads more clearly than
one number - and nobody can answer that before the thing ships. So the
change landed unfinished, stayed active all day, and the owner found it
in the Pipeline reading "Merged in #619", which sounds exactly like
"finished".

That is one instance of a shape this repository keeps producing. The
Human-Only Inbox's own header records it from 2026-09-09: "six changes
not started, is that deliberate?" - about six changes that were finished
and waiting on a live check. Six then, six today. The inbox showed them,
which treated the symptom; the cause is that **a change is held hostage
by one item nobody can close yet**.

The owner cut it on 2026-09-20: close the item, with a note saying what
the person decided, rather than carrying an exception. Exceptions are
what has to be remembered, checked and argued about; a rule with no
exception is checkable by a machine.

The one thing a rule must not do is make us write down something that
did not happen. So an item that is genuinely a judgement of the shipped
thing does not get ticked as done - it leaves the change and goes to the
inbox, which outlives it.

## What Changes

- **An item ends in one of three ways, and all three are closed.**
  - **done** - it was carried out, and the line records what was done and
    by whom: the implementing agent, the person, or a named agent the
    item was delegated to.
  - **waived** - the person looked and decided not to do it. The line
    records who waived it and why.
  - **deferred** - a judgement about the shipped thing. The line records
    that the question has moved to the deferred list, and the change is
    free.
- **A change lands with nothing open.** The merge gate refuses a change
  with any open item, naming each. It applies to the change the pull
  request is for, which this repository names its branch after, and says
  nothing about anybody else's active change.
- **A tick without a record is not a tick.** An item marked human-only or
  delegated that is closed as done with nothing written under it is
  reported by the gate. "I looked" is a claim; what was run and what was
  seen is evidence, and evidence is what the archive keeps.
- **A deferred question moves to one file.** `openspec/deferred.md`
  holds the judgements that outlive their changes, each naming the change
  that raised it, and the inbox reads it. The change's own item is closed
  with a record of where the question went. Reading them out of the
  archive instead was measured and rejected: 285 archived changes,
  309 ms, on every collection, for one item.
- **Two alarms, where before there was silence.** A change whose items
  are all closed but which has no pull request at all - work that never
  left the machine. And one whose pull request was closed without
  merging - work declared done and then rejected.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - how an item ends, and what the inbox collects.
- `ci-cli` - the merge gate refuses a change with anything open.
- `openspec-workbench` - the two alarms are said where a change's
  standing is said.

## Impact

- `packages/core/src/task-checklist.ts` (how an ending is read),
  `packages/core/src/deferred-items.ts` (new) and
  `packages/core/src/human-only-inbox.ts` (it reads them),
  `packages/core/src/change-state-word.ts` (the alarms),
  `packages/cli/src/openspec-validate.ts` and `main.ts` (the gate),
  `.github/workflows/quality.yml` (the branch names the change).
- A changeset: core and the CLI both change.

## Explicitly out of scope

- **Rewriting the task lists that exist.** The three endings are how an
  item is closed from now on. A change already archived is not edited,
  and an open item closed as a plain `[x]` still reads as done - the gate
  asks for a record only where the item is marked human-only or
  delegated.
- **Deciding for the person.** Nothing waives an item on its own, and
  nothing defers one on its own. Both are written by whoever decided.
- **Running a delegated item.** That machinery exists
  (`a-delegated-item-runs-its-agent`); this change only records that an
  item ended by it.
- **Archiving automatically.** The change is repository content and its
  archive is a commit, as settled on 2026-09-20.
