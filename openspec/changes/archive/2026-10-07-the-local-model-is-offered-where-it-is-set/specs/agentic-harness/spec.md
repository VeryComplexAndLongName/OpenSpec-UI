## ADDED Requirements

### Requirement: A configuration says where its agent can write nothing

Where a configuration puts an agent that edits no file on `propose`,
`apply` or `verify` - stages whose work is files: the proposal, the
implementation, the ticked tasks - the configuration's findings SHALL say
that the stage writes nothing on that agent and that the agent can review.
`local-llm` is such an agent. The finding SHALL NOT be made for `review`.

#### Scenario: The chat-only local agent on propose and verify

- **WHEN** the global configuration names `local-llm` on `propose`,
  `review` and `verify`
- **THEN** the findings say once that `"propose" and "verify"` on
  `local-llm` write nothing, and say nothing of `review`
