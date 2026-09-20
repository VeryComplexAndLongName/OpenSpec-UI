## MODIFIED Requirements

### Requirement: Pull requests receive automated quality checks

The repository SHALL run typechecking, linting, unit and contract tests, and
delivery builds with the pinned Node.js and npm versions for every pull
request, except the version pull request, which receives the check described
in "The version pull request is checked for what it changes".

It SHALL run the same checks on a merge group - a pull request's tentative
merge, taken by the merge queue - so that what lands has been checked
against the commit it lands on. In a merge group the version pull request
is not distinguishable by a head branch, so it receives the ordinary
checks there.

A push to `main` SHALL NOT run these checks again. What lands on `main` is
what a pull request's checks, and its merge group's checks, ran on, as
"Main receives only what its pull request checked" requires.

#### Scenario: A pull request introduces a type error

- **WHEN** CI evaluates the pull request
- **THEN** the quality job fails before the change can be treated as releasable

#### Scenario: A pull request merges

- **WHEN** a pull request whose checks passed is merged to `main`
- **THEN** the run for that push performs the release path and does not run
  the quality checks, the merge gate, the extension suite or the browser
  suite again

#### Scenario: A pull request enters the merge queue

- **WHEN** a pull request that is ready to land joins the queue
- **THEN** the required checks run on its merge group, against the tip it
  would land on, and it merges only if they pass

### Requirement: Main receives only what its pull request checked

A pull request SHALL NOT merge to `main` unless its required checks passed on
a branch that is up to date with `main`. Where `main` has moved since the
checks ran, the branch SHALL be brought up to date and checked again before
it can merge.

That updating and checking SHALL be done by the merge queue rather than by
hand: a pull request that is ready to land joins the queue, the queue
takes it against the current tip, runs the required checks on that
tentative merge, and lands it only if they pass.

A check skipped by its own condition SHALL satisfy the requirement, so that
the version pull request is not held by the suites it does not run and an
ordinary pull request is not held by the version pull request's check.

#### Scenario: Main moves under an open pull request

- **WHEN** another pull request merges while this one's checks have passed
- **THEN** this one cannot merge until it is brought up to date and its
  checks pass again, which the queue does without anybody updating the
  branch

#### Scenario: The version pull request

- **WHEN** the version pull request's own check passes and the suites it
  does not run are skipped
- **THEN** it can merge

#### Scenario: Several pull requests are ready at once

- **WHEN** more than one pull request is ready to land
- **THEN** the queue takes them in order, and no pull request is left
  stale by another one landing first
