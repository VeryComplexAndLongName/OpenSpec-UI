## ADDED Requirements

### Requirement: The forge is the one origin is on

`packages/core` SHALL ask about pull requests the forge that the
workspace's `origin` is on:

- GitHub, through `gh`, for github.com;
- GitLab, over its REST API, for gitlab.com;
- for any other host, whichever of Gitea and GitLab answers its version
  endpoint.

`GITEA_URL` or `GITLAB_URL` SHALL name the web root where `origin` does
not. A host that answers neither SHALL be taken for GitHub.

GitLab and Gitea SHALL be asked with the token in `GITLAB_TOKEN` or
`GITEA_TOKEN`. Where the token is absent, the reading SHALL say so rather
than guess. The archive pass and the standings SHALL both ask this forge.

#### Scenario: A workspace on Gitea

- **WHEN** `origin` is `http://gitea.local:3000/owner/repo.git` and the
  host answers `/api/v1/version`
- **THEN** pull requests are read from, opened on and merged through that
  Gitea

#### Scenario: No token

- **WHEN** the forge is Gitea and `GITEA_TOKEN` is not set
- **THEN** the reading is unavailable and says `GITEA_TOKEN is not set`

#### Scenario: A merged Gitea pull request whose branch was deleted

- **WHEN** Gitea reports a merged pull request's head as
  `refs/pull/<n>/head`
- **THEN** the pull request is filed under the branch its label names
