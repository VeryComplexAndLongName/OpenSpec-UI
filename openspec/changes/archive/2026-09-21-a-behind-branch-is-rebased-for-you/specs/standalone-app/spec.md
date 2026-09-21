## MODIFIED Requirements

### Requirement: The Summary says what the workspace left behind

The Summary SHALL say what the workspace left behind: the directories under
`openspec/changes/` that carry no documents, and the working directories
that are finished with.

The standalone SHALL run the same working-directory sweep the editor runs,
from the same core function: a working directory whose work has landed is
removed, and a change's branch that has fallen behind is rebased and
pushed with a lease (ADR 0034). What that sweep did SHALL be said first,
under "Done for you", in the sentences core gives every host. Until this,
the standalone only offered to remove a finished working directory while
the editor removed it.

A leftover the product cleared SHALL be named after it is cleared, so a
directory does not simply disappear. A leftover the product will not clear
SHALL be offered for removal, with what it holds stated beside the offer,
and a working directory that is finished with but kept - its tree holds
uncommitted work - SHALL be offered the same way, with what made it
finished.

Where nothing was left behind and the sweep did nothing, the Summary SHALL
say nothing rather than show an empty panel.

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
- **THEN** the sweep removes it, and the Summary says so under "Done for
  you"

#### Scenario: Nothing left behind

- **WHEN** every directory under `openspec/changes/` is a change and every
  working directory still has work
- **THEN** the Summary shows no panel for this

#### Scenario: A branch rebased for you

- **WHEN** the sweep rebased a behind change branch and pushed it
- **THEN** the Summary says which branch, onto what, and that its checks
  will run again
