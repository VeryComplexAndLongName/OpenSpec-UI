## MODIFIED Requirements

### Requirement: Main receives only what its pull request checked

A pull request SHALL NOT merge to `main` unless every required check has
passed on it.

`main` SHALL NOT additionally require the branch to be up to date with
it. That rule cost more than it guarded here: a check run takes minutes,
another pull request lands inside that window, and the branch is stale
again before it is green. The guarantee it gave - that the checks ran on
a tree containing the current tip - is given properly by a merge queue,
which is a feature of repositories owned by an organization and is
therefore not available to this one.

What remains guaranteed: every required check ran on the change itself,
and a textual conflict with `main` still prevents a merge. What is no
longer guaranteed: that two pull requests which are green apart are green
together.

A check skipped by its own condition SHALL satisfy the requirement, so
that the version pull request is not held by the suites it does not run
and an ordinary pull request is not held by the version pull request's
check.

#### Scenario: Main moves under an open pull request

- **WHEN** another pull request merges while this one's checks have
  passed
- **THEN** this one can still merge, and nobody updates its branch for
  that reason

#### Scenario: The version pull request

- **WHEN** the version pull request's own check passes and the suites it
  does not run are skipped
- **THEN** it can merge

#### Scenario: A pull request that conflicts with main

- **WHEN** a pull request's branch conflicts textually with `main`
- **THEN** it cannot merge until the conflict is resolved
