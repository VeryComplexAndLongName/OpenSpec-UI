## MODIFIED Requirements

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
the workspace. It is pushed and opened through the forge. The directory
and the local branch SHALL be removed afterwards, whatever happened. While
a pull request from an `archive-landed-` branch is open, the sweep SHALL
open no other, and SHALL follow that one instead.

A change whose own pull request merged while its task list still owes
something SHALL NOT be archived, and the sweep SHALL say what it owes.

The forge SHALL be reached through one interface, implemented for GitHub,
GitLab and Gitea.

#### Scenario: Two changes landed with nothing open

- **WHEN** two changes' directories are on the default branch with every
  item closed, and neither has an open pull request
- **THEN** one branch reaches the server with both moved into the archive
- **AND** one pull request is opened, and its checks are read from the
  next pass on
- **AND** nothing of the pass is left on the machine

#### Scenario: A change is still in review

- **WHEN** a change's task list is closed but its own pull request is open
- **THEN** it is not archived

#### Scenario: An archive pull request is already open

- **WHEN** a pull request from an `archive-landed-` branch is open
- **THEN** no other is opened, and the sweep follows that one

#### Scenario: A change landed owing something

- **WHEN** a change's own pull request merged while an item is open
- **THEN** it is not archived, and the sweep names the item

#### Scenario: Nothing is finished

- **WHEN** no change on the default branch has a task list to read
- **THEN** the forge is not asked anything

#### Scenario: One archive fails

- **WHEN** `openspec archive` refuses one of the finished changes
- **THEN** the others are archived, and the one is named with the reason

## ADDED Requirements

### Requirement: The product merges its archive pull request itself

The sweep SHALL follow its open archive pull request and merge it itself.
It SHALL NOT ask any forge for an automatic merge. It SHALL read the
checks through the forge's `checksOf`:

- while checks are pending, it waits;
- where every check that ran passed, or none ran, it merges through
  `mergeNow`, trying squash, then merge, then rebase, and moves to the
  next method only where the forge refused the method;
- where a check failed, it does not merge, and names the check;
- where the forge refuses the merge for another reason, it leaves the pull
  request open and says the forge's reason.

The editor and the standalone server SHALL sweep again every five minutes
while an archive pull request is open. A pass that merges SHALL fetch, so
that the main checkout follows the archive in that same pass.

#### Scenario: A repository that does not allow automatic merge

- **WHEN** an archive pull request's checks have passed on a repository
  whose automatic merge is off
- **THEN** the sweep merges it

#### Scenario: A repository without checks

- **WHEN** an archive pull request has no check at all
- **THEN** the sweep merges it on the pass after it was opened

#### Scenario: A failed check

- **WHEN** a check of an archive pull request failed
- **THEN** the sweep does not merge it, and names the check

#### Scenario: A required approval

- **WHEN** the forge refuses the merge because an approval is required
- **THEN** the pull request stays open, the sweep says the forge's reason,
  and it tries again on the next pass
