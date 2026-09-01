## Why

See `docs/adr/0015-agentic-harness-per-stage-model-selection.md` for the
architectural decision this implements, including why it does not reopen
ADR 0011's rejection of provider/model bindings (that rejection was about
config that names a vendor and drags credential handling back into this
product; this passes a `--model` flag to a CLI that still authenticates
itself).

The concrete need: the intended split is an expensive model for
`propose`/`review`/`archive` and a cheap one for `apply`. Until now that
was expressed by choosing a different CLI per stage — but `copilot-cli`
currently fails on real work in this repository (`Permission denied and
could not request permission from user`). That failure is confirmed not
to be a defect here: it reproduces identically from three independent
callers — a plain shell using the same `cross-spawn` shape, the VS Code
extension host, and the standalone server (a plain Node process outside
VS Code entirely) — while the same CLI, same flags, same spawn shape
succeeds on 30+ tool calls in a scratch directory. With
one usable CLI the agent axis alone can no longer express the split,
while `claude --model` can. Verified on this machine: both
`claude --model <model>` and `copilot --model <model>` exist.

## What Changes

- `packages/core/src/harness-config.ts`: a `stepAgents` entry becomes
  `string | { agent: string; model?: string }`. The bare string keeps its
  meaning, so existing config files stay valid untouched.
- `packages/core/src/agents/registry.ts`: `AgentDescriptor` records
  whether an adapter accepts a model flag, and which flag it is.
- `packages/core/src/harness-config.ts`: a model string is validated at
  config-read time against a closed character set, and rejected outright
  for an agent whose descriptor says it takes no model.
- `packages/core/src/default-runners.ts`: for model-capable adapters, the
  `exact([...])` allowlist matcher is replaced by one that additionally
  admits at most one trailing `--model <validated value>` pair — and
  nothing else.
- `packages/core/src/agents/claude.ts`, `copilot.ts`: pass the model flag
  when a model is resolved for the stage being run.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `agentic-harness`: a stage may name a model alongside its agent, and
  that model is passed to the agent's CLI.
- `execution-core`: the default allowlist admits one validated `--model`
  argument for adapters that accept one.

## Impact

- `packages/core/src/harness-config.ts`, `agents/registry.ts`,
  `default-runners.ts`, `agents/claude.ts`, `agents/copilot.ts`, and the
  corresponding tests.
- `packages/core/src/harness-chain-runner.ts` reads
  `harnessConfig.stepAgents[stage]` in two places (lines ~284, ~327) and
  `packages/extension/src/commands.ts` writes one (line ~169); both must
  handle the widened type.
- No `server`/`webui` behavior change: the agent picker keeps building
  from `AGENT_REGISTRY` and is not given a model selector by this change.
