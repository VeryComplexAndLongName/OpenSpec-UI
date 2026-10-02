## ADDED Requirements

### Requirement: A stage may name the local model

A `stepAgents` entry SHALL accept a model for `local-llm` and
`local-llm-acp`, as it does for an agent whose CLI takes `--model`, and the
Harness Settings views SHALL offer the model field for both. The model
SHALL be optional: an entry without one SHALL keep its meaning, and the
model SHALL then be found as `execution-core` describes. A model SHALL be
checked against the same permitted character set as any other.

#### Scenario: A model for the local agent

- **WHEN** a stage's entry is `{ "agent": "local-llm-acp", "model": "QuantTrio/Qwen3.6-35B-A3B-AWQ" }`
- **THEN** the configuration is read without error, and the stage's run
  uses that model

#### Scenario: No model for the local agent

- **WHEN** a stage's entry is `"local-llm-acp"` alone
- **THEN** the configuration is read without error, and the model is
  found from the settings or the server
