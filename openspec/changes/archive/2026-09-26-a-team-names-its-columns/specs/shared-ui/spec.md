## ADDED Requirements

### Requirement: A team names the board's columns

Where `openspec/board.json` names columns, the board SHALL draw them in
place of a column per stage: each column headed by its title, holding the
cards of every stage it names, counting them, and drawn with the picture
and colour of its first stage.

A column SHALL be a view of stages, never a stage. The file SHALL be
refused whole, and the board SHALL say why and draw a column per stage,
where a stage is in no column, a stage is in two, a name is not a stage,
or the columns do not keep the stages' order, one neighbouring run of
stages to each column. A card SHALL still say its own stage, and SHALL
move only when its facts move it.

Both hosts SHALL read the file from their own workspace root, with the
board's other readings.

A user asked on 2026-09-24 for a board of their own columns; ADR 0037's
decision 11 had deferred it until someone outside this repository did
(amended 2026-09-26).

#### Scenario: A team's columns

- **WHEN** `openspec/board.json` joins Drafted and Proposed as "Backlog",
  and a change is Drafted
- **THEN** its card stands in "Backlog", which counts it, and the card
  says "Drafted"

#### Scenario: A file that leaves a stage out

- **WHEN** no column holds Archived
- **THEN** the board draws a column per stage, and says that
  `openspec/board.json` is not used because no column holds "archived"

#### Scenario: No file

- **WHEN** there is no `openspec/board.json`
- **THEN** the board draws a column per stage, and says nothing about it
