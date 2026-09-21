---
"@openspec-ui/core": patch
"openspec-ui-vscode": patch
---

The Change Graph no longer holds a processor at 100%

The view read the whole graph - archive included - once for every open
row, and again on every file event under `openspec/`, so a run ticking
tasks re-read the archive many times a second. It now reads once per
drawing, shared by every row, and refreshes only when something it reads
changes: a change's `.openspec.yaml`, or a change directory appearing or
going. A ticked task no longer touches it.

A reading of this repository's 293 archived changes takes 159 ms; it was
never the archive's size.
