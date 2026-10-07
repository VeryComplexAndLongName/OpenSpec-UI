## ADDED Requirements

### Requirement: A chain updates a plan its review sends back

After its review stage, a chain SHALL run `update` before `apply` where the
review's verdict is `changes needed`, once, and SHALL go on to `apply` where
the verdict is `ready` or there is none. The update SHALL run on the review
stage's agent. The update SHALL be reported as part of the review stage, so
the chain keeps its six stages: its time and spend count toward the review
stage's, and a checkpoint after the review comes after the update. A
failed update SHALL end the chain before `apply`.

#### Scenario: Changes needed

- **WHEN** a chain's review ends with `Review verdict: changes needed`
- **THEN** the chain runs `update` on the review's agent, then `apply`

#### Scenario: Ready

- **WHEN** a chain's review ends with `Review verdict: ready`
- **THEN** the chain goes on to `apply` without an update

#### Scenario: The update fails

- **WHEN** a chain's review asks for changes and the update that follows it
  fails
- **THEN** the chain ends with the update's failure and `apply` does not
  start
