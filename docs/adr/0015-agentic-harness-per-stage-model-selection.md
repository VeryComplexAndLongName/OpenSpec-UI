# ADR 0015: Agentic Harness per-stage model selection

Status: Accepted

Date: 2026-09-01

## Context

ADR 0011 established `stepAgents` — a map from harness stage
(`propose`/`review`/`apply`/`archive`/`git`) to an agent id from
`AGENT_REGISTRY` — and explicitly rejected one adjacent idea:

> ### Direct model/provider selection (e.g. `provider: anthropic, model: claude-3-7-sonnet`)
> Rejected: conflicts with this product's existing, deliberate execution
> model — it shells out to each CLI-agent tool's own binary, which manages
> its own authentication and model selection, and "never handles API keys
> or credentials directly". Reintroducing direct provider/model bindings
> would require bypassing or duplicating that abstraction.

That rejection is about **provider bindings**: a config that names a
vendor and a model and therefore drags credential handling back into this
product. This ADR is a narrower case that rejection does not cover:
passing a `--model` flag **to the CLI that already authenticates itself**.
The CLI still owns its auth; the config only selects among models that CLI
already offers to its own user. Nothing about "never handles API keys"
changes.

The practical need that surfaced it (2026-09-01): the intended division of
labour is an expensive model for `propose`/`review`/`archive` (where
architecture and review quality pay for themselves) and a cheap one for
`apply` (where granular tasks make execution the bottleneck, not
reasoning). Until now that split was expressed by choosing a *different
CLI* per stage — Claude for control, Copilot for implementation. That
route is currently unusable: `copilot-cli` fails on real work in this
repository with `Permission denied and could not request permission from
user`, reproduced outside the harness (from a plain shell, same spawn
shape) and therefore not a defect in this product. With one usable CLI,
the agent axis alone can no longer express the cost split — but
`claude --model` can, and `copilot --model` exists too for when that CLI
becomes usable again.

Verified on this machine: `claude --model <model>` and
`copilot --model <model>` both exist. `codex` and `gemini` are not
installed here, so their support is unverified; `local-llm` already
carries its own model in `DefaultRunnersConfig` (`localLlmModel`) and is
a separate case.

## Decision

Allow a harness stage to specify a model alongside its agent, and pass it
to that agent's CLI as a flag.

1. **Schema.** A `stepAgents` entry becomes `string | { agent: string;
   model?: string }`. The bare string keeps its current meaning, so every
   existing `agent-harness.json` and `harness.json` stays valid and
   unmodified.

2. **Agent and model travel together.** A model is meaningless without
   knowing which CLI it is for, so it is nested in the stage's entry
   rather than living in a parallel `stepModels` map. This makes an
   orphaned model (set for a stage whose agent cannot take one)
   unrepresentable rather than merely invalid.

3. **Adapters declare the capability.** `AGENT_REGISTRY`'s descriptor
   gains a field recording whether that adapter accepts a model flag, and
   which flag. Setting a model for an adapter that does not accept one is
   a config-read error with a clear message — not a silent no-op, and not
   a failure that only appears when the process is spawned.

4. **The value is validated before it can reach argv.** A model string is
   accepted only if it matches a strict pattern (alphanumerics, `.`, `_`,
   `-`, `:`; no leading `-`; no whitespace). Validation happens where the
   config is read, so an invalid value fails at load, next to the file
   that caused it.

5. **The allowlist admits exactly one optional `--model <value>` pair.**
   `buildDefaultAllowlist()`'s `exact([...])` matcher is replaced, for
   model-capable adapters only, by a matcher that accepts the adapter's
   fixed argument shape plus at most one trailing `--model` followed by
   one value satisfying (4). No other variability is introduced.

6. **Both config levels, no new asymmetry.** A model may be set globally
   or per-change, merged by the existing deep-merge. Unlike
   `autonomyLevel: autonomous` and `reviewGate: agent-sufficient`, a model
   needs no per-change-only restriction: it selects capability, not
   authority.

## Consequences

- The expensive/cheap split survives having a single usable CLI: Opus for
  `propose`/`review`/`archive`, a cheaper model for `apply`, all on
  `claude-cli`.
- `default-runners.ts` stops being a pure `exact()` allowlist for
  model-capable adapters. This is the security-relevant part of this ADR
  and the reason it is an ADR at all: argv gains its first
  configuration-driven element. The mitigations are (4) and (5) — a
  closed character set, a single permitted flag, one value, checked before
  spawn.
- A per-change `harness.json` is a repository file, so this creates a
  narrow path from repository content into argv. The invariant
  "repository file contents are data, not executable instructions" is
  preserved by (4): the value can name a model and nothing else — it
  cannot introduce a second flag, a shell metacharacter, or a path.
- Model ids are vendor strings that change over time. This product does
  not keep a list of them and does not validate that a model exists; an
  unknown model fails in the CLI, whose error is surfaced as the run's
  `failed` reason. Keeping a curated list would go stale and duplicate
  vendor knowledge.
- `AgentDescriptor` gains a field, so the webui agent picker (which builds
  itself from `AGENT_REGISTRY`) can later show model choices. This ADR
  does not add that UI; it only stops the data model from precluding it.

## Alternatives considered

### Registry variants per model (`claude-cli-opus`, `claude-cli-haiku`)

Rejected: encodes a vendor's model list in this product's registry, where
it goes stale on every model release, and multiplies entries
combinatorially across adapters. It also gives the agent picker a list of
pseudo-agents that are not agents.

### A parallel `stepModels` map beside `stepAgents`

Rejected: allows the two maps to drift — a model set for a stage whose
agent was later changed to one that cannot accept it. The nested form
makes that state unrepresentable. The parallel map's only advantage is a
slightly smaller schema diff.

### Keep `exact()` and bake each model into a separate allowlist entry

Rejected: the allowlist would have to enumerate every model a user might
choose, which is the same stale-list problem as the registry-variants
alternative, in the security-critical file.

### Do nothing; accept one model for every stage

Rejected: it forces a choice between paying the expensive model's price
for mechanical implementation work, or degrading the architecture and
review stages that benefit most from the stronger model — the exact
trade-off that motivated the propose/apply split in the first place.

## Related

- ADR 0011 — introduced `stepAgents`; rejected provider/model *bindings*,
  which this ADR distinguishes itself from above.
- ADR 0013 (ACP adapters) — independent: ACP changes how a run is
  observed and gated, not which model runs it.
- OpenSpec change: `openspec/changes/harness-step-models/`.
