## ADDED Requirements

### Requirement: A delegated run leaves a reply to its request

A delegated item's run SHALL record its request before the agent starts,
and its reply when the run ends, as audit log entries that share one
envelope:

- an identifier;
- a kind, request or reply;
- on a reply, the identifier of the request it answers;
- from and to, naming a person by git author or an agent by its id;
- a timestamp;
- a body;
- on a reply, an outcome: closed, left open, refused, or failed.

The reply SHALL be recorded whatever the outcome, and its body SHALL hold
the end of what the agent last said. The waiting-on inbox SHALL show the
latest reply beneath its item.

#### Scenario: A run that leaves its item open

- **WHEN** a delegated run ends cleanly and its item is still open
- **THEN** the audit log holds a reply whose outcome is left open and whose
  body holds the agent's last words, and the inbox shows it beneath the
  item

#### Scenario: A run that closes its item

- **WHEN** a delegated run ticks its item with evidence
- **THEN** the audit log holds a reply whose outcome is closed

### Requirement: A delegated agent is asked to answer within its turn

A delegated item's prompt SHALL tell the agent:

- to wait for every command it starts, in the turn it was given;
- not to leave work running in the background;
- to end its turn with what it did and, where the item is not closed, why.

#### Scenario: The prompt a delegated agent receives

- **WHEN** a delegated item is run
- **THEN** its prompt holds the instruction to answer within the turn and
  not to leave work in the background
