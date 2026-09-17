---
"@openspec-ui/webui": minor
"@openspec-ui/core": minor
"openspec-ui-vscode": patch
---

The Timeline's one-change screen now looks like the approved mockup, in the
standalone shell and in the editor's timeline panel. "Tasks over time" places
the change's proposal, each moment its tasks were ticked, and its archive on
a rail, with tasks ticked in one commit shown as one moment ("5 tasks ticked
in one commit") that opens to its tasks. Beside it, a Tasks tile gives done of
total and how long the change took, and a Dates panel gives each date with
where it was read from. Open tasks, done tasks with no date, and the
proposal, design and specs stay available below. Choosing a change loads it,
with no button to press, and the page head names the change.

A task reads as its whole sentence: core's task checklist items carry
`continued`, the lines `tasks.md` wraps a task onto.
