## ADDED Requirements

### Requirement: Archiving a change offers a Changesets reminder when appropriate

For a workspace that has adopted Changesets (`.changeset/config.json`
exists), the extension SHALL check, after a successful archive, whether
any changeset is currently pending, and SHALL offer to start `npx
changeset` in an integrated terminal when none is. A workspace that has
not adopted Changesets SHALL see no such reminder. The check SHALL NOT
block, delay, or affect the outcome of the archive operation.

#### Scenario: Archiving with Changesets adopted and nothing pending

- **WHEN** a change is archived in a workspace with
  `.changeset/config.json` and no pending `.changeset/*.md` file
- **THEN** the extension shows an information message offering to run
  `npx changeset`
- **AND** choosing that action opens an integrated terminal and runs
  `npx changeset`

#### Scenario: Archiving with a changeset already pending

- **WHEN** a change is archived in a workspace with
  `.changeset/config.json` and at least one pending `.changeset/*.md`
  file
- **THEN** no reminder is shown

#### Scenario: Archiving in a workspace that has not adopted Changesets

- **WHEN** a change is archived in a workspace with no
  `.changeset/config.json`
- **THEN** no reminder is shown

#### Scenario: The reminder check fails

- **WHEN** the Changesets presence/pending check throws or the
  filesystem is unreadable
- **THEN** the archive operation's own success result is unaffected
- **AND** no error is surfaced for the failed check
