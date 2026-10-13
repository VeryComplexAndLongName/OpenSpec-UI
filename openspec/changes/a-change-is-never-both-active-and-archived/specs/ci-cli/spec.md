## ADDED Requirements

### Requirement: The merge gate refuses a change that is both active and archived

With `--base <ref>`, `validate` SHALL fail on every change the working tree
has active whose name the base has archived, naming the change and the
base's archived folder for it. A change the base still has active SHALL NOT
be named: the archive's own pull request holds the active copy in the commit
before it moves it.

#### Scenario: A change put back after its base archived it

- **WHEN** `validate --base origin/main` runs on a branch that has
  `cli-is-visible-on-the-homepage` active and `origin/main` has
  `2026-10-10-cli-is-visible-on-the-homepage` archived
- **THEN** the report fails, naming the change and that it is archived as
  `2026-10-10-cli-is-visible-on-the-homepage`

#### Scenario: The archive's own pull request

- **WHEN** `validate --base origin/main` runs on the branch that archives
  `landing`, and `origin/main` still has `landing` active
- **THEN** the change is not named for being both active and archived
