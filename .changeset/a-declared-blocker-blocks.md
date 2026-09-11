---
"@openspec-ui/core": minor
---

A declared blocker blocks.

A change may state in its own `.openspec.yaml` that it cannot start
until another lands. That was computed, reported by
`openspec-ui-cli ready`, and read by nothing that starts a run — so a
change saying of itself "do not start me yet" started.

A chain is now refused before its first stage when a declared blocker is
still an active change, naming every unmet blocker rather than the
first. There is no option that starts it anyway: the declaration is a
sentence its author wrote in a version-controlled file, and the remedy
is to land the blocker or delete the line.

Unchanged: an unmet blocker is still not a validation failure. Whether
the repository validates and whether a run may start now are different
questions.
