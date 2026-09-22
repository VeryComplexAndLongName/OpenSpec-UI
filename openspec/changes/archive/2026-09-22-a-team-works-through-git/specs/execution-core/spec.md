## ADDED Requirements

### Requirement: The people of a repository are in git

`packages/core` SHALL read the people of a repository from
`openspec/people/<handle>.json`, one file per person. Each file holds:

- a handle made of lower-case letters, digits and single hyphens, which
  names the file;
- a name;
- at least one Ed25519 public key with its key id and the date it was
  added;
- optionally, e-mail addresses.

A key MAY carry a retirement date. A file that is not a person, and a key
listed in two people's files, SHALL be reported with the file and the
reason. The people's keys SHALL form a roster that `openEnvelope` verifies
against, retired keys included, and a verified person SHALL be named by
their name and handle.

#### Scenario: A colleague's signature

- **WHEN** an envelope is signed by a key listed in a person's file
- **THEN** it opens as verified, naming that person and their handle

#### Scenario: One key, two people

- **WHEN** two people's files list the same key
- **THEN** the second file is reported, naming whose key it already is

### Requirement: Joining writes a person's file and commits nothing

Joining SHALL write the person's file with this machine's public key, or
add the key to the file the person already has, and SHALL commit
nothing. It SHALL refuse a handle that is not one, and a key that is
already another person's. Joining with a key the file already holds
SHALL write nothing and say so.

#### Scenario: A second machine

- **WHEN** a person who has a file joins from another machine
- **THEN** that machine's key is added to their file, and the first key
  stays

### Requirement: People and keys are never taken out

Compared with the ref it merges into, a pull request SHALL NOT remove a
person, remove a key, replace a key, or change a retirement date already
recorded. Adding people, keys, e-mail addresses and retirement dates
SHALL be allowed.

#### Scenario: A lost machine

- **WHEN** a pull request adds a retirement date to a person's key
- **THEN** it is allowed, and what the key signed before still verifies

#### Scenario: A key deleted

- **WHEN** a pull request deletes a key from a person's file
- **THEN** it is refused, saying to retire the key instead
