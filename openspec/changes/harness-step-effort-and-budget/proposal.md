## Why

Raised directly in a repository conversation on 2026-09-02: a stage can
be given an agent and a model, but not a reasoning effort or a spending
cap, and both are configurable in the CLIs themselves.

`HarnessStepAgent` is `string | { agent, model?, dispatch? }`. There is no
effort and no budget. And even if there were, the run would not start:
`default-runners.ts`'s `exactWithOptionalModel` admits **exactly one**
optional `--model <validated>` pair —

```ts
if (args.length !== expected.length + 2) return false;
```

— so any further flag is rejected. That is the allowlist working as
designed (`harness-step-models`: an agent's argv is a fixed, pre-approved
shape), and it is the wall this change has to widen deliberately rather
than work around.

Investigated per agent, live where the CLI is installed on this machine
and from upstream sources where it is not:

| agent | reasoning effort | spending cap |
|---|---|---|
| `claude-cli` | `--effort <level>`: `low, medium, high, xhigh, max` — **live-verified** | `--max-budget-usd <amount>`, `--print` only — **live-verified** |
| `copilot-cli` | `--effort` / `--reasoning-effort <level>`: `none, minimal, low, medium, high, xhigh, max` — **live-verified** | `--max-ai-credits <credits>`, minimum 30 — **live-verified** |
| `codex-cli` | `-c model_reasoning_effort="<level>"` — a generic config override, not a dedicated flag; **not live-verified**, binary not installed here | none found |
| `gemini-cli` | no command-line flag; thinking level is set in the interactive `/model` menu, with open upstream feature requests for a flag; **not live-verified** | none found |

The four disagree on **mechanism**, not merely on values. Two have a
dedicated flag; one exposes it only through a generic `-c key=value`
config override; one cannot express it from the command line at all.

Sources for the table above:

- `claude`: [CLI reference](https://docs.claude.com/en/docs/claude-code/cli-reference)
  and [Manage costs effectively](https://docs.claude.com/en/docs/claude-code/costs).
  Note a version gate: `--max-budget-usd` requires Claude Code v2.1.217 or
  later, and subagent spend counts toward the cap.
- `copilot`: [Setting an AI credit session limit](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/set-session-limit),
  [CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)
  and [Optimizing your AI usage](https://docs.github.com/en/copilot/tutorials/optimize-ai-usage).
  One AI credit is $0.01 USD; the minimum session limit is 30 credits.
- `codex`: [openai/codex#28113](https://github.com/openai/codex/issues/28113)
  and [Codex CLI non-interactive mode](https://codex.danielvaughan.com/2026/03/26/codex-cli-cicd-non-interactive/).
- `gemini`: [google-gemini/gemini-cli#25122](https://github.com/google-gemini/gemini-cli/issues/25122)
  and [#6693](https://github.com/google-gemini/gemini-cli/issues/6693) —
  both open feature requests, which is the evidence that no flag exists.

Copilot's own documentation independently confirms the constraint this
project already wrote into `agent-usage-accounting`'s spec: its credit
limit is *"a soft cap: usage is known only after a model response
returns. A response can therefore exceed or exhaust the limit before the
CLI can observe that it has done so; the next model call is then
blocked."* The same property, at a finer boundary — per model call rather
than per stage.

## What Changes

- `packages/core/src/harness-step-agent.ts`: `HarnessStepAgent`'s object
  form gains an optional `effort` and an optional `budget`. Both settable
  in the global `openspec/agent-harness.json` and in a per-change
  `openspec/changes/<id>/harness.json`, deep-merged exactly as
  `stepAgents`, `autonomyLevel` and `checkpoints` already are.
- Same file: a closed set of effort values, and a per-agent statement of
  which of them that agent accepts.
- `packages/core/src/agents/`: `claude.ts` and `copilot.ts` render their
  own flags; `codex.ts` renders the `-c model_reasoning_effort=` override
  for that key only; `gemini.ts` renders nothing and rejects the setting.
- `packages/core/src/default-runners.ts`: the allowlist matcher
  generalizes from one optional pair to a set of named, individually
  validated optional pairs.
- `packages/webui` / `packages/extension`: the harness settings surface
  shows both fields, per stage.

## Capabilities

### New Capabilities

(none — this extends `agentic-harness` and `execution-core`)

### Modified Capabilities

- `agentic-harness`: a stage entry may carry a reasoning effort and a
  spending cap, globally or per change; an agent that cannot express one
  refuses it rather than ignoring it.
- `execution-core`: the allowlist admits a fixed set of validated
  optional argument pairs rather than a single one.

## Impact

- `packages/core`: `harness-step-agent.ts`, `harness-config.ts`,
  `default-runners.ts`, four adapters.
- `packages/webui`, `packages/extension`: presentation of two new fields.
- No change to the command/event protocol, to `spawnAndStream`, or to any
  existing configuration's meaning. An entry without the new fields
  behaves exactly as today.

## Explicitly out of scope

- Replacing `agent-usage-accounting`'s stage-boundary budget. The two are
  complementary: ours spans a change's runs and stops a chain; a CLI's own
  cap bounds one run from inside. Neither subsumes the other.
- Converting between dollars and AI credits. There is no rate we hold, and
  inventing one is the "local price table" ADR 0017 already rejected.
- Adding effort or budget for `codex-cli` and `gemini-cli` on the strength
  of documentation alone — see tasks; those two are gated on live
  verification, matching how ADR 0013 recorded `gemini --experimental-acp`
  as documented but unverified.
