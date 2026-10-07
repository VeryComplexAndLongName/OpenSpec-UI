## ADDED Requirements

### Requirement: The product's own agent asks in its turn

`local-llm-acp` SHALL offer a tool `ask_operator` taking one argument,
`question`. Calling it SHALL emit a `question` event and write the question
to `decisions.md` as any question is, and SHALL block the agent's loop
until the question is answered; the answer SHALL be the tool's result, and
the turn SHALL go on. `local-llm` SHALL NOT offer it.

#### Scenario: Asking mid-turn

- **WHEN** `local-llm-acp` calls `ask_operator` with "Keep the target
  filter?" and the operator answers "Yes"
- **THEN** the loop waits until the answer, the tool's result is "Yes", and
  the agent continues its turn
