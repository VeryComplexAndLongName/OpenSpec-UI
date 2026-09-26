# Name the board's columns

The Pipeline's board has a column per stage: Drafted, Proposed, Planned,
In progress, In review, Landed, Archived. A team that works in fewer, or
calls them something else, names its own.

**1.** Write `openspec/board.json` beside `openspec/agent-harness.json`,
and commit it, so everyone on the team sees the same board:

```json
{
  "columns": [
    { "title": "Backlog", "stages": ["drafted", "proposed"] },
    { "title": "Ready", "stages": ["planned"] },
    { "title": "Doing", "stages": ["in-progress"] },
    { "title": "Review", "stages": ["in-review"] },
    { "title": "Done", "stages": ["landed", "archived"] }
  ]
}
```

**2.** Open the Pipeline and press **By stage**. The board reads the file
with its other readings, so a change to it shows within a minute.

A column is a view of the stages, never a stage of its own:

- every stage is in exactly one column;
- the columns keep the stages' order, and a column joins neighbouring
  stages only;
- a card moves when its facts move it (a commit, a ticked task, a pull
  request), never by being dragged, and it still says its own stage.

A file that breaks one of these is not used. The board then says why,
under the columns, and draws a column per stage. The decision and its
limits are in
[ADR 0037](../adr/0037-a-team-works-through-git.md), "Amendment, 2026-09-26".
