## Context

`codex-acp` is the ACP server for Codex: started with no arguments, it
answers `session/new` with `configOptions`. Read live on 2026-10-24
(`@agentclientprotocol/codex-acp` 2.2.2, signed in through ChatGPT):

| Option | Values | Default |
| --- | --- | --- |
| `mode` | `read-only`, `workspace-write`, `agent` ("Auto review"), `agent-full-access` | `agent` |
| `model` | `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` | `gpt-6.1-sol` |
| `reasoning_effort` | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` | `medium` |
| `collaboration_mode` | `default`, `plan` | `default` |
| `fast-mode` | `off`, `on` | `off` |

`session/set_config_option` set `mode`, `model` and `reasoning_effort`,
and each answer echoed the options' new values. In `workspace-write` the
agent wrote `hello.txt` without a permission request; the prompt's answer
was `{"inputTokens":6186,"cachedReadTokens":32512,"cachedWriteTokens":0,
"outputTokens":86,"thoughtTokens":0}` and two `usage_update`s carried
`used`/`size` (475,000).

## Goals / Non-Goals

**Goals:** `codex-cli-acp` runs a stage with the sandbox, model and effort
the stage needs, refuses what the session does not offer, and records what
it spent.

**Non-Goals:** a catalog read outside the session; setting
`collaboration_mode` or `fast-mode`; `deepseek-cli-acp`'s model.

## Decisions

### Session options live in the shared driver (ADR 0052)

`AcpRunOptions` gains `sessionOptions: { agent, set }`. Inside the
session, before the prompt, every option is checked against
`newSessionResponse.configOptions` (a select's options, flat or grouped),
and only when all pass is each one sent with `session/set_config_option`,
in order. A refusal ends the run as `failed` with its code, and nothing is
set or prompted. The check is in the driver, not in each adapter, because
only the driver holds the session's answer.

*Alternative: the adapter reads a catalog first, as `codex-cli` does with
`codex debug models`.* The session already says what it offers, in an
answer the run waits for anyway; a second process would be a second source
that can disagree with it.

### `mode` is `codex-cli`'s sandbox

`codexSandboxFor(kind)` from `codex.ts` (ADR 0051) gives the mode:
`codex-acp` names its two non-delegating modes exactly as `codex exec`
names its sandboxes. `agent` would leave what a stage may do to codex's own
review; `agent-full-access` is never wanted.

### Efforts: `low` to `max`

As for `codex-cli`: `ultra` (automatic task delegation) is left out. The
list is checked against the session too, so a model that drops a level is
refused in words.

### The model is a session option

`registry.ts` marks `codex-cli-acp` `takesModel`, so a stage may name one
and the settings surfaces offer the field; the session's own list is the
check.

### Cached tokens by the schema's names

`buildAcpUsage` read `cacheReadTokens` and `cacheCreationTokens`; the
schema's `Usage` has `cachedReadTokens` and `cachedWriteTokens`. Read by
the schema's names, for every ACP agent.

## Risks / Trade-offs

- A bridge that renames an option makes every run on it fail until the
  adapter follows. That is the intent: refused in words, not run with a
  default nobody chose.
- The model asked an operator question in the live run (whether a file at
  the repository root is within its scope). That is the product's question
  flow working, not this change; it is noted, not handled here.
