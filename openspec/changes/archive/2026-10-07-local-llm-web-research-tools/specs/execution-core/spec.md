## MODIFIED Requirements

### Requirement: AgentRunner abstracts specific CLI agents

The system SHALL provide one execution interface that hides differences
between specific CLI agents (Claude CLI, GitHub Copilot CLI, Codex CLI,
Gemini CLI) and local LLM via OpenAI-compatible API behind adapters, each
translating agent specifics into the same protocol event stream. In addition,
`local-llm` and `local-llm-acp` SHALL expose the shared `search_web` and
`fetch_webpage` tools defined by `web-research`. `local-llm` SHALL offer no
repository file or command tools. No command or event kinds are added or
changed.

#### Scenario: A local model uses a web tool

- **WHEN** either local model adapter receives a valid call to `search_web`
  or `fetch_webpage`
- **THEN** it returns the tool result to the model and continues the run
  using the existing protocol events

#### Scenario: Direct local LLM is offered only web tools

- **WHEN** `local-llm` sends its completion request
- **THEN** its offered tools are limited to `search_web` and `fetch_webpage`

#### Scenario: Unexpected agent output format

- **WHEN** an adapter receives output that does not match expected format
  (for example after a CLI update)
- **THEN** the system forwards that output as `stdout` without data loss and
  without crashing the run