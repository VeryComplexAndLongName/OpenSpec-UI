## ADDED Requirements

### Requirement: The drift between a checkout and its remote is readable

`packages/core` SHALL report, for a workspace, which branch it is on, how
many commits that branch is behind and ahead of the same branch on its
remote, and which of the changes the workspace can see are archived on the
default branch.

The reading SHALL NOT fetch: it reports what the refs already say, and
SHALL state when they were last fetched so a stale count reads as stale.

#### Scenario: A reading of a checkout behind its remote

- **WHEN** the workspace's default branch is behind the same branch on its
  remote
- **THEN** the reading says the branch, the number of commits behind and
  ahead, when the refs were last fetched, and which visible changes the
  default branch already carries archived

#### Scenario: A reading costs no fetch

- **WHEN** the drift is read
- **THEN** no fetch is run, whatever the age of the refs

### Requirement: Catching up is a fast-forward that refuses rather than risks

`packages/core` SHALL offer to bring the checkout's default branch up to
its remote by fast-forward alone.

It SHALL refuse, naming which of these it is, when:

- the working tree is not clean;
- the branch has commits the remote branch does not have;
- the checkout is not on its default branch.

It SHALL NOT stash, merge, rebase or pull. A refusal SHALL leave the
repository as it was.

#### Scenario: A checkout behind its remote

- **WHEN** the default branch is behind its remote and the tree is clean
- **THEN** the reading says how far behind, and catching up moves the
  branch to the remote's commit

#### Scenario: A tree with uncommitted work

- **WHEN** catching up is asked for and the tree is not clean
- **THEN** nothing moves, and the refusal says the tree is not clean

#### Scenario: A branch with commits of its own

- **WHEN** the branch has commits the remote does not have
- **THEN** nothing moves, and the refusal says so with the count

#### Scenario: Another branch checked out

- **WHEN** the checkout is on a branch that is not its default
- **THEN** nothing moves, and the refusal names the branch it is on
