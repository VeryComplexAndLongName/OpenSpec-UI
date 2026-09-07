---
"openspec-ui-vscode": minor
---

Add "Reveal in Change Graph" (on a change in Changes/Archive) and "Reveal in Changes" (on a graph row), plus a `openspec-ui.followSelectionInChangeGraph` setting (default `false`) that reveals the graph automatically as the Changes/Archive selection changes. Locating a change with several rows expands and selects every one of them and reports the count; a change that states no relation is reported as such rather than appearing to do nothing. `ChangesTreeProvider`, `ArchiveTreeProvider`, and `ChangeGraphTreeProvider` gain `getParent`, and the Change Graph view now registers via `createTreeView` so it can be revealed into.
