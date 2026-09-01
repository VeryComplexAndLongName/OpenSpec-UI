## ADDED Requirements

### Requirement: The AI panel populates its change list without a manual load step

The AI panel SHALL read the available OpenSpec changes automatically once
it has a usable working directory, so the change picker is usable as soon
as the panel opens. It SHALL still offer an explicit control to re-read
the change list, because changes can appear on disk while the panel is
open. It SHALL NOT auto-run any command other than the read-only change
listing.

#### Scenario: Panel opens with a known working directory

- **WHEN** the AI panel is shown and its working directory is known
- **THEN** the change list is read automatically and the change picker
  becomes usable without the user pressing anything

#### Scenario: Working directory is not yet known

- **WHEN** the AI panel renders before its working directory is available
- **THEN** no command is sent, and the automatic read happens once the
  working directory becomes available

#### Scenario: A run is already in progress

- **WHEN** the AI panel would auto-read the change list but a command run
  is already in flight
- **THEN** no automatic read is sent, so the in-flight run's output is
  not discarded

#### Scenario: Re-reading after changes appear on disk

- **WHEN** the user invokes the panel's explicit reload control
- **THEN** the change list is read again and the picker reflects the
  current set of changes
