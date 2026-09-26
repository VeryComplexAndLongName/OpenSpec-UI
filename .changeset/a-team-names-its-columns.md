---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

A team can name the board's columns. `openspec/board.json` lists columns,
each a title and the neighbouring stages it holds, such as "Backlog" for
Drafted and Proposed; the Pipeline's board then draws those columns, with
each card where its stage is. A column is a view of the stages: every
stage in exactly one column, in their order, and a card still says its own
stage and moves only when its facts do. A file that breaks a rule is not
used, and the board says why. See docs/how-to/name-the-board-columns.md.
