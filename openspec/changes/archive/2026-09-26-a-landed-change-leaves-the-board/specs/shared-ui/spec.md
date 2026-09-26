## ADDED Requirements

### Requirement: What the default branch archived is Archived on the board

The board SHALL stand a change the default branch already carries archived
in its Archived column, whatever a working directory that has not caught
up still holds of it, and its card SHALL say no time in any other stage.

A copy of such a change left in another working directory SHALL NOT be
drawn as a card of that directory: it is not work. The archive's own card
stands for the change where the archive reading holds it.

A change's stage is read from the directory it is worked in, and a
worktree branched before the archive still holds the change as it was:
finished changes stood In progress on the board after main had archived
them (reported by the owner on 2026-09-26).

#### Scenario: A checkout behind the default branch

- **WHEN** this checkout still holds a change the default branch carries
  archived, and its own facts say In progress
- **THEN** its card stands in Archived

#### Scenario: A copy in another worktree

- **WHEN** another working directory holds a change the default branch
  carries archived
- **THEN** no card is drawn for that copy
