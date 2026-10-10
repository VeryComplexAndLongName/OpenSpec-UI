## ADDED Requirements

### Requirement: A change's own worktree is worked from its card in either arrangement

A card of the change a working directory was made for SHALL offer that
change's actions, from core's one list, whether the Pipeline is arranged by
stage or by step. Among them, Commit Change SHALL commit what the worktree
holds on the change's branch and push it; it SHALL be refused, saying why,
for a change worked in the checkout and while a run of it is going.

Such a card SHALL also offer Run Change..., as a card of this checkout
does, and the run SHALL run in that worktree, with that worktree's harness
settings and task list, in both hosts. While a run of the change reports
from there, the card SHALL say it is running and offer no start.

The survey SHALL say, from the refs it already lists and without running
git in the directory, where that change's branch is not on the server:
never pushed, or at another commit than the server's. The card SHALL say
so in words: "not on the server: its branch was never pushed", or "not on
the server as it is here".

#### Scenario: Arranged by step

- **WHEN** the Pipeline is arranged by step and a working directory below
  it was made for `fresh`
- **THEN** `fresh`'s card there offers its actions, Commit Change among
  them, as it does on the board

#### Scenario: Running a change of its own worktree

- **WHEN** Run Change... is pressed on `fresh`'s card, `fresh` being only in
  its own worktree
- **THEN** the run dialog opens for `fresh` with that worktree's harness
  and open tasks, and a run chosen in it runs in that worktree

#### Scenario: A branch never pushed

- **WHEN** `fresh`'s branch exists here and the server has no branch of
  that name
- **THEN** the card says "not on the server: its branch was never pushed",
  and Commit Change can be pressed

#### Scenario: A change worked in the checkout

- **WHEN** a change is worked in this checkout
- **THEN** its Commit Change says "This change is worked in this checkout,
  not on a branch of its own." and does nothing
