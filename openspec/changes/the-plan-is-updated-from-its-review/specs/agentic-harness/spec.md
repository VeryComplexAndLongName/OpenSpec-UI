## ADDED Requirements

### Requirement: A chain updates a plan its review sends back

After its review stage, a chain SHALL run `update` before `apply` where the
review's verdict is `changes needed`, once, and SHALL go on to `apply` where
the verdict is `ready` or there is none. The update SHALL run on the agent
`stepAgents.update` names, or on the review stage's agent where it names
none. The update SHALL be reported as part of the review stage, so the
chain keeps its six stages.

#### Scenario: Changes needed

- **WHEN** a chain's review ends with `Review verdict: changes needed`
- **THEN** the chain runs `update` on the review's agent, then `apply`

#### Scenario: Ready

- **WHEN** a chain's review ends with `Review verdict: ready`
- **THEN** the chain goes on to `apply` without an update
