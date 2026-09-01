## Context

The architectural decision, its alternatives, and the reasoning about ADR
0011 all live in `docs/adr/0015-agentic-harness-per-stage-model-
selection.md` and are not repeated here. This design covers only how it
lands in the code.

Current shape: `HarnessStepAgents = Partial<Record<HarnessStage, string>>`
(`harness-config.ts:19`), validated by `assertValidStepAgents`
(`harness-config.ts:91`), consumed at `harness-chain-runner.ts:284` and
`:327`, and produced at `commands.ts:169`. The allowlist is
`exact([...])` per agent id in `default-runners.ts:37-45`.

## Goals / Non-Goals

**Goals:**

- Express "expensive model for control stages, cheap model for `apply`"
  in config, with one usable CLI.
- Fail at config-read time, with a message naming the offending key, for
  anything invalid — never at spawn time, never silently.

**Non-Goals (this change):**

- A model selector in the agent picker UI. The registry gains the data
  that would make it possible; the UI is a separate change.
- Validating that a model id actually exists. This product keeps no list
  of vendor model ids (ADR 0015, Consequences) — an unknown model fails in
  the CLI and surfaces as the run's `failed` reason.
- `codex-cli`/`gemini-cli` model support. Neither CLI is installed on the
  machine where this was designed, so their flags are unverified; their
  descriptors declare no model support until someone can verify them.
- `local-llm`. It already carries a model in `DefaultRunnersConfig`
  (`localLlmModel`); reconciling the two is out of scope and its
  descriptor declares no `stepAgents` model support.

## Decisions

### Widen the entry, keep the string form working

`string | { agent: string; model?: string }`. Every existing
`agent-harness.json`/`harness.json` and every existing test that uses the
string form stays valid and is not rewritten. A single normalizing helper
converts either form to `{ agent, model? }` at the read boundary, so
nothing downstream has to know both shapes.

**Rejected alternative**: a parallel `stepModels` map. Rejected in ADR
0015 — it permits a model set for a stage whose agent cannot accept one.

### Validation is a closed character set, not an escape

Accepted model strings match `^[A-Za-z0-9][A-Za-z0-9._:-]*$`. This is an
allow-list of characters, not an attempt to escape a denylist: a value
that cannot contain whitespace, quotes, or a leading `-` cannot become a
second flag or a shell construct, whatever the surrounding quoting does.

**Rejected alternative**: escape/quote the value at spawn time. Rejected
— `cross-spawn` on Windows resolves `.cmd` shims through `cmd.exe`, whose
quoting rules already cost this repository one live bug
(`copilot-prompt-length-limit`). Constraining the value is verifiable by
reading one regex; getting quoting right across shells is not.

### Capability lives in the registry, checked at config read

`AgentDescriptor` gains the flag name (e.g. `modelFlag: "--model"`), and
its absence means "this adapter takes no model". `assertValidStepAgents`
rejects a model for such an adapter, naming the stage and the agent.

**Rejected alternative**: let the adapter ignore a model it cannot use.
Rejected — a config that says `apply` runs on a cheap model, silently
ignored, produces expensive runs the user believes are cheap. Failing at
read time is the only outcome that cannot be misread.

### The allowlist matcher admits one pair, positionally last

For model-capable adapters the matcher accepts the adapter's existing
fixed arguments, optionally followed by exactly `--model` and exactly one
value matching the pattern above. Not "contains `--model` somewhere", not
"any extra arguments allowed".

## Risks / Trade-offs

- **[Risk]** `default-runners.ts` stops being a pure `exact()` match, so
  argv gains its first config-driven element — the security-relevant part
  of this change. → **Mitigation**: the three independent constraints
  above (closed character set, single permitted flag, single value,
  checked before spawn), plus a test that a model containing a space, a
  quote, or a leading `-` is rejected at config read.
- **[Risk]** A per-change `harness.json` is a repository file, so this is
  a path from repository content into argv. → **Mitigation**: the same
  validation. The value can name a model and nothing else; the invariant
  is that repository content is data, and a constrained model id stays
  data.
- **[Trade-off]** An unknown-but-well-formed model id fails only when the
  CLI runs. Accepted: the alternative is a curated vendor list that goes
  stale (ADR 0015).

## Migration Plan

No migration. The string form remains valid, so no existing config file
changes and nothing needs rewriting. A model is opt-in per stage.
