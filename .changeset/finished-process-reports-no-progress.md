---
"@openspec-ui/core": patch
"openspec-ui-vscode": patch
---

Stop showing finished runs as still working. A run that reported progress
kept that value after finishing, and the Processes view printed it beside
the state — `usage-from-acp · completed · Running`. The marker that
produced it is no longer reported, a terminal row no longer shows a live
field, and journal load drops that marker from records already written.
The lease-reclamation note, which nothing else records, is preserved.
