---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

A change lands with nothing open

A task item now ends in one of three ways, and all three are closed:
**done** (with what was done and by whom), **waived** (a person looked
and decided not to), or **deferred** (a judgement about the shipped
thing, which moves to the workspace's deferred list and stops holding a
change open).

The merge gate takes `--change <id>` and refuses that change where any
item is open, or where an item marked human-only or naming an agent is
closed with nothing written under it. It applies to that change alone:
a pull request for one change never fails for another change's open
item.

`openspec/deferred.md` holds the questions that outlive their changes,
each naming the change that raised it, and the Human-Only Inbox reads
it. Reading them out of the archive instead was measured and rejected:
285 archived changes, 1.76 MB, 309 ms on every collection.

Two words are new where there was silence: a change whose items are all
closed but which has no pull request at all, and one whose pull request
was closed without merging.
