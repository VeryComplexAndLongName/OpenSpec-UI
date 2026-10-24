## ADDED Requirements

### Requirement: An ACP agent's settings are session options, checked then set

An ACP adapter MAY name session options for its run. The shared ACP
session driver SHALL check every named option against the `configOptions`
the agent's `session/new` answer lists, and only when every one is listed,
with the named value among its values, SHALL set each with
`session/set_config_option`, in order, before the prompt. An option the
session does not list SHALL fail the run with `OSW-AGT-223`, and a value
it does not list for that option with `OSW-AGT-224`, each naming what the
session does list; in either case no option SHALL be set and no prompt
sent.

#### Scenario: Options set before the prompt

- **WHEN** a run names `mode` = `workspace-write` and `model` =
  `gpt-6-luna`, and the session lists both with those values
- **THEN** both are set, in that order, and the prompt is sent after them

#### Scenario: A value the session does not list

- **WHEN** a run names `model` = `gpt-x`, and the session lists the models
  `gpt-6.1-sol` and `gpt-6-luna`
- **THEN** the run fails with "codex-acp takes the model values
  gpt-6.1-sol, gpt-6-luna, not \"gpt-x\"", and nothing is set or prompted

#### Scenario: An option the session does not list

- **WHEN** a run names `reasoning_effort`, and the session lists only
  `mode` and `model`
- **THEN** the run fails with `OSW-AGT-223`, naming `mode` and `model`

### Requirement: Codex over ACP runs in a named sandbox, with the stage's model and effort

The `codex-cli-acp` adapter SHALL start `codex-acp` with no arguments and
SHALL name, as session options: `mode`, the sandbox `codex-cli` names for
the same command (`workspace-write` for plan, implement, update and
verify, `read-only` otherwise); `model`, where the stage names one; and
`reasoning_effort`, where the stage names one. It SHALL never use
`codex-acp`'s `agent` or `agent-full-access` mode. `codex-cli-acp` SHALL
accept a model and the efforts `low`, `medium`, `high`, `xhigh` and
`max`.

#### Scenario: An apply stage on codex over ACP

- **WHEN** an `implement` command runs on `codex-cli-acp` with the model
  `gpt-6.1-sol` and the effort `low`
- **THEN** the session's `mode` is set to `workspace-write`, its `model` to
  `gpt-6.1-sol` and its `reasoning_effort` to `low`, before the prompt

#### Scenario: A review on codex over ACP

- **WHEN** a `review` command runs on `codex-cli-acp`
- **THEN** the session's `mode` is set to `read-only`

### Requirement: An ACP agent's cached input is recorded by the schema's names

The shared ACP session driver SHALL read a prompt answer's cached input
from ACP's `Usage` fields `cachedReadTokens` and `cachedWriteTokens`, and
SHALL record them as the run's cache-read and cache-creation input tokens.

#### Scenario: Codex's answer with cached input

- **WHEN** a prompt's answer carries `inputTokens` 6186,
  `cachedReadTokens` 32512, `cachedWriteTokens` 0 and `outputTokens` 86
- **THEN** the run's usage records 6186 input, 32512 cache-read and 0
  cache-creation input tokens, and 86 output tokens
