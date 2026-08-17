## ADDED Requirements

### Requirement: Standalone shell can report which agents are detected

The standalone delivery SHALL expose an endpoint that reports, per
registered agent id, a best-effort presence signal for that agent's
underlying CLI executable or HTTP endpoint. The agent picker SHALL
annotate each option with the result without removing or disabling any
option, regardless of detection outcome.

#### Scenario: User loads the AI panel and agents are detected

- **WHEN** the AI panel mounts in the standalone browser tab
- **THEN** the client requests detection results and annotates each agent
  option in the picker with "detected" or "not detected", and every
  option remains selectable either way

#### Scenario: User refreshes detection

- **WHEN** the user clicks "Refresh agents"
- **THEN** the client requests detection again and updates the
  annotations, without altering the currently selected agent

#### Scenario: Detection endpoint is unreachable or errors

- **WHEN** the detection request fails
- **THEN** the picker falls back to showing no annotation (equivalent to
  "unknown"), not an error state that blocks selecting or running an
  agent
