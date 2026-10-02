# Spec Delta

## MODIFIED Requirements

### Requirement: The local LLM is told where it is, and its key stays out of files

`packages/core` SHALL resolve the local LLM's base URL, model and API key
from what the host was told, and for each one it was not told, from the
process environment: `OPENSPEC_UI_LOCAL_LLM_BASE_URL`,
`OPENSPEC_UI_LOCAL_LLM_MODEL` and `OPENSPEC_UI_LOCAL_LLM_API_KEY`; and
otherwise from the defaults it always had, `http://localhost:30000` and
`default`, with no key. An empty value SHALL count as none.

A base URL SHALL be accepted with its `/v1` or without it: the request
SHALL go to `<base>/chat/completions` where the base ends in `/v1`, and to
`<base>/v1/chat/completions` otherwise.

Where a key is set, it SHALL be sent as `Authorization: Bearer <key>` on
every request to the server, the availability check included, and SHALL
NOT be written to the audit log, a run log, or any file the product
writes. None of the three SHALL be read from `agent-harness.json`: that
file is committed, an address on the LAN is one machine's, and a key
committed is a key published.

The editor SHALL offer the base URL and the model as settings, and SHALL
keep the key in its secret storage, set by a command.

In addition to the existing HTTP adapter, the system SHALL offer
`local-llm-acp`, which SHALL run a local ACP coding process through the
shared ACP session driver while using the same resolved base URL, model,
and optional API key. The API key SHALL remain out of files here as well.

`local-llm-acp` SHALL expose a strict invocation contract for agent-loop
ceilings that can be passed to the ACP process: max iterations, max tool
calls, max run seconds, prompt/completion/total token ceilings, and
context ceilings (used/context window share/min free tokens). A value that
is not present SHALL be omitted rather than guessed.

This adapter-level loop contract SHALL NOT replace harness chain/stage
controls (`timeout.maxRunSeconds`, `timeout.maxStageSeconds`,
`maxStageAttempts`, and `budget.maxContextShare`): those controls SHALL
continue to bound change-level and task/stage-level execution.

Until this, local OpenAI-compatible usage could run only over direct HTTP,
with no ACP tool/permission flow and no ACP-native loop contract.

#### Scenario: A server that wants a key

- **WHEN** the base URL is `http://gpu.lan:8000/v1` and a key is set
- **THEN** the request goes to `http://gpu.lan:8000/v1/chat/completions`
  with the key as a bearer token

#### Scenario: Nothing set

- **WHEN** no setting and no environment variable names the local LLM
- **THEN** the request goes to `http://localhost:30000/v1/chat/completions`
  for model `default`, with no authorization header

#### Scenario: The editor's settings and the environment

- **WHEN** the editor sets the model and the environment sets the base URL
  and the key
- **THEN** the model is the editor's, and the base URL and the key are the
  environment's

#### Scenario: ACP local LLM reuses endpoint settings

- **WHEN** `local-llm-acp` is selected and base URL/model/API key are
  resolved from settings/environment
- **THEN** the adapter starts its ACP process with that same endpoint
  identity and does not persist the key to files

#### Scenario: ACP local loop limit contract is explicit

- **WHEN** loop limits are configured for `local-llm-acp`
- **THEN** only the documented limit fields are passed to the ACP process,
  and each absent field is omitted

#### Scenario: Harness time and retries still bound change and task/stage runs

- **WHEN** a chain runs with `timeout.maxRunSeconds`,
  `timeout.maxStageSeconds`, or `maxStageAttempts` configured
- **THEN** those ceilings still govern change-level and task/stage-level
  execution regardless of whether `local-llm` or `local-llm-acp` is selected
