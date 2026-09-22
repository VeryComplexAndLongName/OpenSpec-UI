---
"openspec-ui-vscode": patch
---

A change you have not written yet takes a relation

A directory in `openspec/changes/` that holds only its `.openspec.yaml`,
as `/opsx:new` leaves it, is listed with a (?) because it is not a change
yet. Right-clicking it used to open nothing. It now offers Add Relation and
Remove Relation, and its tooltip says the rest of a change's menu arrives
with its first proposal, design, tasks or specs. An archived change's
leavings still offer only removal, now from the right-click menu as well.

Remove Relation is offered only on a change that states a relation, rather
than opening to say there is nothing to remove.

HARNESS.md now lists a stage's model among the settings the harness views
edit, and the per-change review gate pick describes `agent-sufficient` as
the `git` stage behaves today.
