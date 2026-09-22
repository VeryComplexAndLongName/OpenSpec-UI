---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

A change has an Owner, an Implementer and a history

Each change can now have an Owner, who answers for it, and an
Implementer, who does the work, by hand or through agents. Who holds a
change comes from its history: one signed file per event in
`openspec/changes/<id>/history/`, committed with the change.

- `openspec-ui-cli owner` records who owns the change.
- `openspec-ui-cli implementer` records who implements it.
- `openspec-ui-cli send-back` returns the change to an earlier stage with
  a reason, reopening the task items you name.
- `openspec-ui-cli history` shows it all.

Only the Owner hands a change on, and an agent's action is marked as the
agent's. The merge gate refuses any history that was edited or deleted.
