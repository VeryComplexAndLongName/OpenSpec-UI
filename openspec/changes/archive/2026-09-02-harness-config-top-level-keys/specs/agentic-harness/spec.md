## ADDED Requirements

### Requirement: An unrecognized key at the top level of a harness configuration is an error

A harness configuration file carrying a top-level key the system does not
define SHALL be refused. The refusal SHALL name the unrecognized key and
list the keys that are defined.

This SHALL apply to the workspace-wide configuration and to a per-change
configuration alike.

The system SHALL NOT accept such a file with the unrecognized key
disregarded, and SHALL NOT infer what the key was meant to be.

#### Scenario: A stage named at the top level

- **WHEN** a per-change configuration names a stage at its top level,
  outside the key that holds stage entries
- **THEN** the file is refused, naming that key, and the message may
  name the correct location as a possibility

#### Scenario: A misspelled top-level key

- **WHEN** a configuration carries a top-level key the system does not
  define
- **THEN** the file is refused, naming that key and the defined ones

#### Scenario: The workspace-wide file

- **WHEN** the workspace-wide configuration carries such a key
- **THEN** it is refused the same way as a per-change one

#### Scenario: A configuration with only defined keys

- **WHEN** every top-level key in a configuration is one the system
  defines
- **THEN** the file is accepted as before, and settings that used to
  migrate still migrate
