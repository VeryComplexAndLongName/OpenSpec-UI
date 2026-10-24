## Why

`codex-cli-acp` started the `codex-acp` bridge with no arguments and set
nothing: no model, no effort, no sandbox. Its capabilities entry was
deliberately empty, written before the bridge had ever been installed
here. On 2026-10-24 `@agentclientprotocol/codex-acp` 2.2.2 was installed
and read live: it offers its sandbox (`mode`), its `model` and its
`reasoning_effort` as ACP session options, its default mode is codex's own
"Auto review", and it reports tokens. The same reading found that the
shared ACP driver looks for cached tokens under names no agent sends, so
no ACP agent's cached input has ever been recorded.

`codex-cli` became a full agent in `codex-cli-is-a-full-agent`; this
change does the same for Codex over ACP.

## What Changes

- **Session options in the shared driver.** An ACP adapter can name
  session options; the driver checks each against the `configOptions` of
  `session/new` and then sets them with `session/set_config_option`, before
  the prompt. An option or a value the session does not list fails the run
  before anything is set, naming what it does list (`OSW-AGT-223`,
  `OSW-AGT-224`).
- **`codex-cli-acp` sets its sandbox, model and effort.** `mode` is the
  sandbox `codex-cli` names for the command (ADR 0051): `workspace-write`
  for plan, implement, update and verify, `read-only` otherwise. `model`
  and `reasoning_effort` are the stage's, where it names them. It accepts
  the efforts `low`, `medium`, `high`, `xhigh`, `max` and takes a model; it
  reports tokens and a context gauge.
- **Cached tokens by the schema's names.** The driver reads
  `cachedReadTokens` and `cachedWriteTokens`, ACP's own field names, for
  every ACP agent.
- ADR 0052; HARNESS.md, LIMITS.md and README.md say what was measured.

Not in this change: `deepseek-cli-acp`'s model as a session option, and
codex's `collaboration_mode` and `fast-mode`.

## Capabilities

### Modified Capabilities

- `acp-agent-adapters`: an ACP adapter sets its settings as checked
  session options; `codex-cli-acp` takes a sandbox, a model and an effort;
  cached tokens are read by the schema's names.

## Impact

- `packages/core/src/agents/acp-session-driver.ts`, `agents/codex-acp.ts`,
  `agents/registry.ts`, `harness-step-agent.ts`, `message-register.ts`.
- Harness schemas regenerated: `codex-cli-acp` takes an effort.
- Requires `codex-acp` on the PATH (`npm install -g
  @agentclientprotocol/codex-acp`), as before.
