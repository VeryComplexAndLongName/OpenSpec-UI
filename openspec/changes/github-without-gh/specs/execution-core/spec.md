## ADDED Requirements

### Requirement: GitHub is asked over its API where a token is set

Where `origin` is on github.com and `GITHUB_TOKEN` or `GH_TOKEN` is set,
`packages/core` SHALL ask GitHub over its REST and GraphQL APIs, and
SHALL need no `gh`. Without a token it SHALL go through `gh`. Where `gh`
is not installed or not signed in, the reading SHALL say that no
`GITHUB_TOKEN` is set either.

#### Scenario: No gh, a token

- **WHEN** `gh` is not installed and `GITHUB_TOKEN` is set
- **THEN** the standings, the archive pass and the `git` stage work
  against GitHub

#### Scenario: Neither

- **WHEN** `gh` is not installed and no token is set
- **THEN** the reading says "gh is not installed, and GITHUB_TOKEN is not
  set"

### Requirement: The git stage works on the forge origin is on

The `git` stage SHALL open its pull request, read its checks and merge it
on the forge `origin` is on, where that forge can read checks. It SHALL
use the `gh` gateway otherwise. It SHALL merge only on a pass, read the
same way for every forge, and refuse where no check ran.

#### Scenario: A Gitea pull request with no checks

- **WHEN** the `git` stage opens a pull request on Gitea and its commit has
  no status
- **THEN** the stage does not merge, and says no check result was
  available
