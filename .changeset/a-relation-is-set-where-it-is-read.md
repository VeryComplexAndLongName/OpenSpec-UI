---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
---

A relation is added and removed from the row that shows it

Asked for by DW: manage a dependency with a mouse, rather than by editing
`.openspec.yaml` by hand.

A change's row in the Changes view and in the Change Graph now offers Add
Relation and Remove Relation. Adding asks which relation - Follows,
Supersedes or Blocked by, each with the sentence that says what it means -
and then which change, from every change the workspace has, active first,
with the ones that relation already names marked. Removing offers only the
relations the change actually states.

Core owns the file. A new `change-relations-file.ts` rewrites one relation
key in a change's metadata and passes every other line through as it found
it: other keys, comments, key order, the file's own line endings and its
trailing newline. A flow sequence stays a flow sequence, and a key left
with no value is removed rather than left in a shape the parser reports as
an error.

The checks that were the lint gate's happen at the edit. An edit naming a
change the workspace does not have, a change naming itself, or one that
would close a cycle is refused with the reason before anything is written,
and the cycle is found by the same `findChangeGraphCycles` the gate uses,
run over the graph as it would be after the edit. The refusal is a value a
host shows, not an exception it has to parse. An archived change's
relations are drawn and never edited.
