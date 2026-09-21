## ADDED Requirements

### Requirement: A change's branch that falls behind is rebased and pushed with a lease

The working-directory sweep SHALL rebase a change's branch onto the
default branch and push it with `--force-with-lease`, against the
upstream as it was read before the rebase, where every one of these
holds, each checked rather than assumed:

- the branch bears the name of a change the directory holds;
- its configuration allows it - `branches.rebaseWhenBehind`, absent
  meaning `true`, read from the directory the branch is checked out in so
  that a change in flight answers for itself;
- no run is recorded against its working directory;
- it has an upstream, and that upstream is not gone;
- it is equal to its upstream: nothing of it exists only on this machine,
  and nothing of the server's is missing here;
- it is behind the default branch;
- its working tree is clean.

Each directory whose branch is left alone SHALL carry the one condition
that left it.

A conflict SHALL never be resolved: the rebase SHALL be aborted before the
sweep moves on, leaving the branch and its tree exactly as they were, and
the files in conflict SHALL be named. A push the lease refuses SHALL put
the branch back at the commit it was on.

This setting SHALL NOT widen what the `git` stage may do, and SHALL NOT
push a commit the server has never seen (ADR 0034).

#### Scenario: A behind branch

- **WHEN** a change's pushed branch, equal to its upstream and clean, is
  behind the default branch
- **THEN** it is rebased onto it and pushed, and the server's copy carries
  the default branch's commits beneath the change's

#### Scenario: A conflict

- **WHEN** the rebase conflicts
- **THEN** it is aborted, the branch and its tree are as they were, and
  the files in conflict are named

#### Scenario: Somebody else pushed first

- **WHEN** the lease refuses the push
- **THEN** the branch is put back at the commit it was on, and the refusal
  is reported

#### Scenario: Work that exists only here

- **WHEN** the branch has commits its upstream does not
- **THEN** it is left alone, since a push would carry new work

#### Scenario: Turned off

- **WHEN** the workspace's configuration, or the change's own, sets
  `branches.rebaseWhenBehind` to `false`
- **THEN** that branch is left alone, and the reason says so
