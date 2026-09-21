## ADDED Requirements

### Requirement: The editor says what the archive pass did

The editor SHALL write every line the workspace sweep says about the
archive to its output channel. It SHALL raise a notification when the
sweep opened an archive pull request, saying whether it merges when its
checks pass. It SHALL raise a warning, once in a session per change, for a
change that landed still owing something.

#### Scenario: The sweep opened an archive pull request

- **WHEN** the sweep archives two changes in pull request #700
- **THEN** a notification names #700 and the two changes

#### Scenario: A change landed owing something

- **WHEN** the sweep finds a change that landed with an item open, twice
  in one session
- **THEN** a warning names the change once
