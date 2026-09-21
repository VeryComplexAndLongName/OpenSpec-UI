---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

A change is archived only when it owes nothing

`archiveChange` refuses a change that still has an item open, or a
human-only or delegated item closed with nothing written under it, and
names each. Every way this product archives - the Pipeline, the editor,
a harness stage, the standalone server - goes through it.

The merge gate takes `--base <ref>` and holds every change a pull
request archives to the same rule, however the archive was made -
including `openspec archive` run directly, which this product does not
control. It compares the archive's two listings and needs no history,
and a base it cannot read fails the gate rather than passing it.

What an item still owes is decided once, in core, and read by both.
