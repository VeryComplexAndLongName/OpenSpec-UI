## Why

Every active change in this repository is blocked on a person, and
nothing says so.

Counted 2026-09-06: **14 active changes, and every one of them has
exactly one open task, marked human-only.** Not one is waiting on code.
Finding that out means opening fourteen `tasks.md` files and reading to
the end of each; it was done by hand three times in a single working
session before it was written down.

`openspec/README.md` already states the rule those items live by — "An
item marked human-only stays open until a person reports it done. Passing
automated checks are not evidence for it, and neither is half of it
having been observed." The rule is sound and the queue it creates is
invisible.

Two related failures have the same shape, and both are now detectable
because the relation between changes is recorded.

**A named successor that was never created.** Three changes in a row
named residue they had honestly not resolved, archived, and the residue
lost its owner. `change-dependency-graph` made a *stated* edge
verifiable; it cannot catch prose that says "Successor created: X" while
no change states it follows this one. That is the exact wording those
three used.

**A spec delta that has drifted.** Twice in one day, archiving was
refused because a `MODIFIED` block no longer matched the spec it
modified — `agentic-harness-git-stage` had lost three scenarios someone
else had added, `harness-git-stage-no-agent` targeted a requirement
header that no longer existed. Both were discovered at the archive step,
after the work was finished and reviewed.

## What Changes

- A view listing every open human-only item across active changes, with
  the change it belongs to, reachable from where changes are worked on.
- A check that fails when a change's tasks name a successor that no
  change states it follows.
- A check that fails when a `MODIFIED` block's requirement header, or its
  scenarios, no longer match the spec it modifies — at pull-request time
  rather than at archive time.

## Capabilities

### Modified Capabilities

- `vscode-extension`: what is waiting on a person is visible without
  opening every change.
- `quality-gates`: a named successor and a stale spec delta are caught by
  a check rather than by the archive step refusing.

## Impact

- A tree provider in `packages/extension` and two checks over
  `openspec/` in `packages/core`, tested there. Changeset needed for
  both packages.

## Explicitly out of scope

- **Ticking a human-only item from the editor.** The rule exists because
  a person reports it done. A button that marks one from a surface which
  cannot observe the thing being verified would defeat it.
- **Notifying, reminding, or nagging.** A list that answers "what is
  waiting on me" when asked. Nothing that interrupts.
- **Guessing which prose names a successor.** The check looks for the
  wording this repository actually used and says what it looked for. A
  fuzzy matcher producing false accusations would be worse than the
  silence it replaces.
