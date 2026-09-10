# Design

## Decision: the shell reads the workspace on open

The root field is filled from the server on open; the overview is what
the schedule needs, and it is loaded as soon as the root is known rather
than on the next interaction. Everything else in the shell that is gated
on the overview — the human-only inbox, the summary — benefits the same
way. A workspace whose overview fails to load reports that failure where
the overview is shown, and the schedule stays untouched, as it does
today.

## Decision: an archived change is a dropped schedule, and says so

`readSchedule` gains a third outcome beside `start` and `dropped`: an
entry whose change is archived is dropped with the reason "archived",
distinct from "no longer exists". A chain does not run against an
archived change — its work is done by definition — so promoting the entry
to `start` was never a run anyone would have asked for. The prefix match
in `stillExists` becomes the archived case rather than the alive case.

Because the entry is no longer promoted, a genuinely due run behind it
no longer waits an extra tick.

## Decision: firing is in core, hosts supply effects

A new function in core takes the entries, the known changes, the clock,
and returns what to write back and what to say: the remaining entries,
the entry to start, its lateness, the dropped entries with their
reasons, the number still waiting. Both hosts call it and perform their
own effects — write the file, open a panel or a dialog, print a line.
Neither host decides anything about the schedule.

The entry is removed from the returned list, but a host writes that list
only after it has opened the run. A host that fails to open the run
leaves the file as it was and reports the failure for what it is: the
run could not be opened, not the schedule could not be read.

## Decision: the stored path is honoured

A due run opens the dialog with the stored path preselected and the run
started, not a dialog waiting for a choice. Where the stored path no
longer exists for the change — the configuration changed since — the
dialog opens as it does now and says why. An entry's `path` therefore
stays; the alternative, one schedule button and no path, would make a
scheduled run less specific than an immediate one.

## Decision: the shell loads the change it points at

Firing calls the same load the editor uses when a change is chosen, so
the files, revision and unsaved-edit state belong to the scheduled
change. If another change has unsaved edits at that moment, the dialog
opens over a message saying so, and the editor is not switched until
the person chooses.

## Decision: a dialog that opens by itself is announced

The dialog's container carries `role="dialog"` and takes focus when it
opens, and the schedule's messages render in a `role="status"` region
that exists in every tab. A screen-reader user is told that a run dialog
opened without their action, and a sighted user on another tab is told
why they were moved.
