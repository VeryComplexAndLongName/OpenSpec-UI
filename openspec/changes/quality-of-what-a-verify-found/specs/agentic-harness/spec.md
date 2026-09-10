## ADDED Requirements

### Requirement: What the verifying stages found is readable per agent

What a change's verifying stages found SHALL be readable back per agent,
beside what the runs cost.

The audit log records how many checks a verifying stage ran and how many
failed. An agent that is cheap and fails its checks is not the cheap one,
and a surface that reports only cost invites exactly that reading.

Each group SHALL carry how many verifying stages it rests on, and a group
resting on fewer than the stated threshold SHALL be reported as such
rather than omitted. Omitting it makes "too little is known here"
indistinguishable from "this agent never fails".

Where nothing has been recorded, the surface SHALL distinguish a log with
no runs from a log whose runs never reached a verifying stage. They are
different facts and only one of them is answered by running something.

Runs recorded against a change that is neither active nor archived SHALL
be excluded, by the same rule the cost figures apply.

#### Scenario: An agent whose checks have failed

- **WHEN** verifying stages have recorded what their checks found
- **THEN** each agent's stages, failures and check counts are readable

#### Scenario: Too few stages to read as a rate

- **WHEN** an agent has fewer verifying stages than the threshold
- **THEN** it is shown and reported as resting on too few

#### Scenario: A log whose runs never verified

- **WHEN** runs are recorded but none reached a verifying stage
- **THEN** the surface says so, distinctly from having no runs at all
