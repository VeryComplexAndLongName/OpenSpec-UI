## ADDED Requirements

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

Until this, the address and the model were fixed in code with no way to
change them, and no key could be sent: a user's server at
`http://192.168.137.33:8000/v1`, which wants one, could not be used.

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
