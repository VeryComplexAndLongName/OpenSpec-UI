## ADDED Requirements

### Requirement: A person's runs sign with that person's key for the machine

A run SHALL sign the record it writes about itself with a key that belongs
to the person running it, on the machine it runs on.

The key SHALL be created the first time it is needed, SHALL have no
passphrase, and SHALL be readable only by its owner where the platform
allows. Each person SHALL have one key per machine, however many runs start
at once.

#### Scenario: The first run on a machine

- **WHEN** a run starts and no key exists for the person on that machine
- **THEN** a key is created, and the run's record is signed with it

#### Scenario: Two runs start at once

- **WHEN** two runs start together and no key exists yet
- **THEN** both runs sign with the same key

### Requirement: What a signature proves is stated exactly

A record SHALL be read as exactly one of three distinct states:

- **verified**: its signature is valid, and its key is enrolled for a
  person;
- **unverified**: it is unsigned, or its key is not enrolled;
- **does not check out**: its signature is invalid, its key does not match
  its identifier, or a different key is enrolled under that identifier.

A record that does not check out SHALL NOT have its contents read or shown,
and SHALL NOT be removed by a sweep.

A verified record SHALL be described as signed by the enrolled person. The
run it describes SHALL still be described as what the record says: a claim.

#### Scenario: An enrolled key

- **WHEN** a record is signed by a key enrolled for a person
- **THEN** it reads as verified, signed by that person

#### Scenario: A key not enrolled

- **WHEN** a record is validly signed by a key that is not enrolled
- **THEN** it reads as unverified

#### Scenario: A changed byte

- **WHEN** one byte of a signed record's contents is changed
- **THEN** the record reads as not checking out, nothing from its contents
  is shown, and a sweep keeps it

#### Scenario: An unsigned record

- **WHEN** a record written without a signature is read
- **THEN** it reads as unverified

### Requirement: The signed bytes are what is read

A record's signature SHALL cover the exact bytes of the record's contents.
Those contents SHALL be parsed only after the signature over them verifies.

#### Scenario: A signature over different bytes

- **WHEN** a record's signature does not verify over the bytes of its
  contents
- **THEN** the contents are not parsed

### Requirement: A run without a key still reports

Where no key can be loaded, a run SHALL write its record unsigned, and SHALL
continue.

#### Scenario: An unreadable key

- **WHEN** a run cannot read the person's key
- **THEN** the run writes an unsigned record and goes on

### Requirement: A key is enrolled by one confirmation

A key that signs a live record and is not enrolled SHALL produce an
enrolment request. The request SHALL carry the run's directory label, its
working directory, the machine, the git author, and when the key was seen.

Confirming the request SHALL enrol the key for the person, once.

Confirming a key identifier that is already enrolled with a different key
SHALL be refused.

#### Scenario: A new machine

- **WHEN** a run on a machine whose key is not enrolled writes a signed
  record
- **THEN** an enrolment request appears for that key, with the facts a
  person needs to decide

#### Scenario: Confirming

- **WHEN** the request is confirmed
- **THEN** that key's records read as verified from then on, and no further
  request appears for it

#### Scenario: A conflicting key

- **WHEN** a confirmation names an identifier already enrolled with another
  key
- **THEN** the confirmation is refused
