## Why

Reviewers on GitLab or Gitea need the same commit-bound evidence available on GitHub. Editing the scenario mappings by hand also requires copying exact titles and check names.

## What Changes

Refresh checks from GitHub, GitLab and Gitea. Report the published head, observed checks with available links, and the expected checks exposed by the forge. Add a scenario and check picker in PR Review and preview the mapping patch before writing it to the current change.

## Capabilities

### Modified Capabilities

- `pr-review` gains the behavior described above.

## Changelog

### VS Code extension and standalone app

- Use **Refresh PR checks** on GitHub, GitLab and Gitea. Choose a reported check for an OpenSpec scenario in PR Review, inspect the mapping diff, and save it to the change.
