## ADDED Requirements

### Requirement: The editor says what the workspace left behind, and sweeps on its own

The extension SHALL read what the workspace left behind when it activates
and again on the interval core settles, clearing what the product itself
left and reporting the rest in the Changes view.

The editor is where a workspace is usually open all day, so it is where a
directory left behind is most likely to be seen — and where it was seen, as
two changes with no tasks, on 2026-09-18.

What it reports SHALL be the same reading the standalone shell shows, from
the same core function, and removing a leftover or a working directory that
is finished with SHALL be a command the person runs, never part of the
sweep.

#### Scenario: Activation clears an archived change's leavings

- **WHEN** the extension activates in a workspace holding a directory whose
  change is archived and which holds only files the product writes
- **THEN** the directory is removed and the Changes view says what was
  cleared

#### Scenario: What it will not clear

- **WHEN** the workspace holds a directory with no documents and no archived
  change of that name
- **THEN** the Changes view reports it, and it is removed only by the
  command

#### Scenario: A sweep that fails

- **WHEN** the sweep cannot remove what it found
- **THEN** the Changes view reports the failure and the extension carries on
