## Why

The owner installed the DeepSeek CLI, `dsh`, on 2026-09-20. They have an
account, an API key and money for checks, and asked on 2026-09-21 for
DeepSeek to be among the agents. They noted it does best with precise,
literal instructions.

`dsh` speaks ACP as one of its profiles: `dsh --profile acp` serves ACP
over stdio. Checked live on 2026-09-22 against 0.1.5-rc.2:
- `initialize` answers as `deepseek-harness-acp` with no auth method, so
  the key lives in the person's own dsh profile;
- `session/new` offers DeepSeek-V4-Flash (the default) and DeepSeek-V4-Pro
  as a session option.

## What Changes

- **A new agent, `deepseek-cli-acp`,** "DeepSeek CLI (ACP)". It runs
  `dsh --profile acp` through the shared ACP driver, is allowed by the
  default allowlist for exactly those arguments, and is detected on the
  PATH like every other agent. It renders no model, effort or budget: the
  model is a session option, and nothing sets session options yet.
- **Every prompt starts with a short preamble** asking it to follow the
  steps literally and in order, to name each step as it finishes, and to
  stop and say why rather than improvise.
- **A silent exit is explained.** On Node 22.11 `dsh` exits with code 0
  before answering, without a word. This repository pins 22.11 with Volta,
  and Volta puts it first on the PATH of what it starts. A run that closes
  before the agent says anything is now told which Node it met, instead of
  "ACP connection closed".
- **What it reports is recorded as measured: nothing.** The live run sent
  no `usage_update` and no usage on the prompt's answer.
- The harness schemas, `HARNESS.md`, `LIMITS.md`, `README.md` and the
  extension's description name it.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - a DeepSeek agent over ACP.

## Impact

- New `packages/core/src/agents/deepseek-acp.ts` and its test.
- `agents/registry.ts`, `default-runners.ts`, `harness-step-agent.ts`, and
  tests for the allowlist and detection.
- `packages/extension/schemas/*.json`, regenerated; the extension's
  `package.json` description.
- `HARNESS.md`, `LIMITS.md`, `README.md`.
- A changeset: core, the server and the extension.

## Explicitly out of scope

- **Choosing DeepSeek's model.** It is an ACP session option
  (`session/set_config_option`), which the shared driver does not send
  yet. V4-Flash is what runs.
- **Fixing the Node a host starts agents with.** The product cannot choose
  the Node on someone's PATH; it says which one it met.
