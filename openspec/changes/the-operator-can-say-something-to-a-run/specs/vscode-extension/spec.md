## ADDED Requirements

### Requirement: A change with a live run can be spoken to

The extension SHALL offer, on a change with a run recorded against it, a
command that sends that run a note or a question, signed with the person's
machine key. The command SHALL say plainly when the change has no live run
to speak to.

When an answer addressed to the person arrives, the extension SHALL tell
them, naming the stage and the run whose words it carries, and SHALL read
each answer once.

#### Scenario: A note is sent from a change's row

- **WHEN** the person sends a note to a change whose run is live
- **THEN** the message is written to the signed directory, addressed to that
  run, and the person is told it was sent

#### Scenario: A change with no live run

- **WHEN** the person asks to speak to a change with no run recorded
- **THEN** the extension says so and writes nothing

#### Scenario: An answer arrives

- **WHEN** an answer addressed to the person is written by a run
- **THEN** the extension tells the person what it says, with the stage and
  the run it came from, and does not tell them the same answer twice

#### Scenario: The channel cannot be read

- **WHEN** the signed directory cannot be read, or this machine has no key
- **THEN** nothing is shown, nothing is raised, and the next reading tries
  again
