## ADDED Requirements

### Requirement: The CLI joins a person to the team and lists the people

`openspec-ui-cli join --handle <handle> --name <text> [--email <address>]`
SHALL write or extend the person's file through the core, and exit `0`
when the file holds this machine's key, `1` when joining was refused, and
`2` when nothing could be read or written. `openspec-ui-cli people` SHALL
list each person with their current and retired keys and each problem
with the files, and exit `1` when there is a problem.

#### Scenario: A key that is somebody else's

- **WHEN** `join` runs on a machine whose key is already in another
  person's file
- **THEN** it exits `1` and names whose key it is

### Requirement: The merge gate checks the people

`validate` SHALL fail when a file in `openspec/people/` is not a person or
a key is in two people's files. With `--base <ref>` it SHALL also fail
when the pull request removes a person or a key, replaces a key, or
changes a retirement date, and SHALL name the file and the reason.

#### Scenario: A key removed

- **WHEN** `validate --base origin/main` runs on a branch that deleted a
  key present on `origin/main`
- **THEN** the report fails, naming the key and saying to retire it instead
