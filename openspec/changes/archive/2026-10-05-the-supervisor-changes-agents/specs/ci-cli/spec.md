## ADDED Requirements

### Requirement: The terminal says when the supervisor moved a stage

`openspec-ui-cli run` SHALL print, under a repeated or moved stage's
heading, why it was attempted again and on which agent.

#### Scenario: A moved stage in the terminal

- **WHEN** a chain run from the terminal moves apply to another agent
- **THEN** the heading names the new agent and the attempt, and the line
  under it says the supervisor moved it and why
