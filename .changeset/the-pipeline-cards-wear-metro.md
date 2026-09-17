---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": patch
---

The Pipeline looks like the approved mockup, in the standalone shell and in
the editor's panel. A card is the site's card: the change's name as its
heading, its state in a coloured badge that still says the word, a bar with
"9 / 22 tasks", a waiting run's question in a callout, each fact with a mark
for its kind, and its controls in a footer, where Start and Continue are the
filled buttons and Stop is outlined in red. An open card lists its tasks as
rows with a tag each. Columns are headed "Step 1 · can start now", the view
has a toolbar with the zoom and Refresh, and the picture, the suggestions and
the other working directories each sit in a panel; a suggestion's command
can be copied.

Core derives every card's height from what it holds (`pipelineCardHeight`),
so nothing is measured and no line is cut at any zoom; `describeChangeCard`
gives each fact a kind and the run's stage, and `describeLane` heads a column.
