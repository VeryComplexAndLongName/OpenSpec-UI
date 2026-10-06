## ADDED Requirements

### Requirement: The git this product starts keeps the person's connection settings, and nothing else guarded

Every `git` the product starts through simple-git SHALL receive, from the
environment it runs in, `GIT_ASKPASS`, `SSH_ASKPASS`, `GIT_SSH`,
`GIT_SSH_COMMAND`, `GIT_SSH_VARIANT` and `GIT_TERMINAL_PROMPT` where they
are set, and SHALL NOT receive any other variable simple-git guards
(every other `GIT_`-prefixed key, `EDITOR`, `PAGER`, `PREFIX`, `VISUAL`).
The product SHALL NOT build any of the allowed variables from a change, a
task or an agent's output.

#### Scenario: An SSH command set by the person

- **WHEN** `GIT_SSH_COMMAND` is set in the environment and the product runs
  git against an SSH remote
- **THEN** git runs that command

#### Scenario: An editor in the environment

- **WHEN** `GIT_EDITOR` is set in the environment and the product runs git
- **THEN** git does not see it
