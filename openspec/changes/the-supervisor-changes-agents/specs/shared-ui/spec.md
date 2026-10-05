## ADDED Requirements

### Requirement: A change's Harness Settings set what the supervisor may do

A change's Harness Settings SHALL offer Act among the supervisor's modes
only where the change's own autonomy level is Autonomous, with a note that
under Act the supervisor may start another agent, which can cost money and
send the change's files to another provider. They SHALL offer each agent
stage's fallback agents and the two allowances, and SHALL save them with
the rest. The global Harness Settings SHALL NOT offer Act or the
allowances.

#### Scenario: Turning Act on

- **WHEN** a person sets a change's autonomy level to Autonomous, chooses
  Act, names `claude-cli-acp` as apply's fallback and saves
- **THEN** the change's `harness.json` carries `supervisor.mode: "act"` and
  `supervisor.fallback.apply: ["claude-cli-acp"]`, and the note about cost
  and providers was shown beside the choice
