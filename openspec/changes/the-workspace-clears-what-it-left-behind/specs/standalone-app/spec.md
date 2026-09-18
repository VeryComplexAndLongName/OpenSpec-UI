## ADDED Requirements

### Requirement: The Summary says what the workspace left behind

The Summary SHALL say what the workspace left behind: the directories under
`openspec/changes/` that carry no documents, and the working directories
that are finished with.

A leftover the product cleared SHALL be named after it is cleared, so a
directory does not simply disappear. A leftover the product will not clear
SHALL be offered for removal, with what it holds stated beside the offer,
and a working directory that is finished with SHALL be offered the same
way, with what made it finished.

Where nothing was left behind, the Summary SHALL say nothing rather than
show an empty panel.

#### Scenario: An archived change's leavings were cleared

- **WHEN** the reading cleared a directory whose change is archived
- **THEN** the Summary names the directory and says it was cleared

#### Scenario: Something the product will not clear

- **WHEN** a directory carries no documents and no change of its name is
  archived
- **THEN** the Summary names it, says what it holds, and offers to remove it

#### Scenario: A working directory that is finished with

- **WHEN** a surveyed working directory's branch has merged and its tree is
  clean
- **THEN** the Summary names it with its branch and offers to remove it

#### Scenario: Nothing left behind

- **WHEN** every directory under `openspec/changes/` is a change and every
  working directory still has work
- **THEN** the Summary shows no panel for this
