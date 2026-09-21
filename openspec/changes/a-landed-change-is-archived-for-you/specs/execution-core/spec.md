## ADDED Requirements

### Requirement: A change that has landed is archived for you

The workspace sweep in `packages/core` SHALL archive every change that has
landed and owes nothing, unless `archive.whenLanded` is `false` for it. A
change has landed and owes nothing when all of these hold on the default
branch, as the server has it after a fetch:

- its directory is in `openspec/changes/`;
- its `tasks.md` has at least one item, and every item is closed and
  recorded;
- no pull request from a branch named after it is open.

Every such change SHALL be archived in one pull request per pass. The pull
request is made on a new `archive-landed-` branch, in a directory outside
the workspace. It is pushed, opened through the forge and asked to merge
when its checks pass. The directory and the local branch SHALL be removed
afterwards, whatever happened. While a pull request from an
`archive-landed-` branch is open, the sweep SHALL open no other.

A change whose own pull request merged while its task list still owes
something SHALL NOT be archived, and the sweep SHALL say what it owes.

The forge SHALL be reached through one interface, implemented for GitHub
through `gh`.

#### Scenario: Two changes landed with nothing open

- **WHEN** two changes' directories are on the default branch with every
  item closed, and neither has an open pull request
- **THEN** one branch reaches the server with both moved into the archive
- **AND** one pull request is opened and asked to merge when its checks
  pass
- **AND** nothing of the pass is left on the machine

#### Scenario: A change is still in review

- **WHEN** a change's task list is closed but its own pull request is open
- **THEN** it is not archived

#### Scenario: An archive pull request is already open

- **WHEN** a pull request from an `archive-landed-` branch is open
- **THEN** no other is opened, and the sweep says what waits for it

#### Scenario: A change landed owing something

- **WHEN** a change's own pull request merged while an item is open
- **THEN** it is not archived, and the sweep names the item

#### Scenario: Nothing is finished

- **WHEN** no change on the default branch has a task list to read
- **THEN** the forge is not asked anything

#### Scenario: One archive fails

- **WHEN** `openspec archive` refuses one of the finished changes
- **THEN** the others are archived, and the one is named with the reason
