## ADDED Requirements

### Requirement: An enrolment request is shown in the Human-Only Inbox, and confirmed there

The extension SHALL show each enrolment request in the Human-Only Inbox,
with its label, working directory, machine, git author and time, and SHALL
offer an action on the request that confirms the person started the run.

#### Scenario: A request in the editor

- **WHEN** a key awaits enrolment
- **THEN** the Human-Only Inbox lists the request with those facts, and its
  action confirms it
