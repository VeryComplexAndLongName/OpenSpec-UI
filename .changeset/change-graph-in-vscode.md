---
"openspec-ui-vscode": minor
---

Show the relation between changes in the editor. A read-only Change Graph
view nests each change under the ones it follows, marks archived changes
and any waiting on a blocker that has not landed, and shows a cycle rather
than letting the subgraph vanish. A new command on a change — Show What
This Change Follows — lists what it grew out of and opens any of them. The
Changes list is unchanged: it is where changes are acted on, and each
appears there exactly once.
