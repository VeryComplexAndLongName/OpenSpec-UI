## ADDED Requirements

### Requirement: PR Review can be tried using a built-in example

Both hosts SHALL offer Open Example without requiring a configured OpenSpec repo or agent. The example SHALL label the data as fictional and include a proposal, tasks, a committed diff and verification. The user SHALL be able to copy the example summary. Opening the example SHALL leave the workspace unchanged and SHALL NOT query GitHub or start an agent.

#### Scenario: A new user wants to see a review

- **WHEN** the user chooses Open Example before configuring OpenSpec
- **THEN** the host shows sample review content and offers Copy PR summary.
