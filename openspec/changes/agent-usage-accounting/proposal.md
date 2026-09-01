## Why

Raised directly in a repository conversation on 2026-09-01: there is no way
to see what an agent run cost, with or without a breakdown by agent. The
decision governing how that data may be obtained is
`docs/adr/0017-structured-agent-output-parsing.md`.

The data exists and this project discards it, in two places, both confirmed
by live investigation rather than assumption:

- `claude -p --output-format json` returns `total_cost_usd`, a full `usage`
  block (input, output, cache-creation, cache-read and thinking tokens) and
  a `modelUsage` map giving cost per model *within one run* — verified live
  on 2026-09-01. `packages/core/src/agents/claude.ts` asks for
  `--output-format text`, so none of it arrives.
- `detectAvailableAgents()` already spawns `<binary> --version` for every
  agent and passes `stdio: "ignore"`
  (`packages/core/src/agent-detection.ts`), discarding the answer.

The cost of not knowing is not hypothetical: the trivial one-word run used
to verify the claim above cost $0.26, almost all of it cache creation. An
`apply` run over a real change is materially more expensive, and nobody in
this project can currently say by how much.

This change deliberately covers only the **accounting** half — the record,
its persistence and its presentation. Per ADR 0017 decision 2, extraction of
usage belongs to the ACP-flavored adapters (`acp-agent-adapters`), where
structured output is the point; converting today's raw-text adapters would
remove the drift-resistant fallback ADR 0013 preserved on purpose. Splitting
it this way also means the plumbing is in place before `acp-agent-adapters`
adds four more adapters, rather than being retrofitted across eight.

The accounting half is not empty without those adapters: agent version has a
producer in this change, since detection already pays for the spawn that
yields it.

## What Changes

- `packages/core/src/security.ts`: `AuditEntry` gains an optional
  `usage` (token counts, vendor-computed cost, optional per-model split) and
  an optional `agentVersion`. `FileAuditLog` already serializes entries as
  JSONL, so persistence follows with no new mechanism.
- `packages/core/src/agent-detection.ts`: stops discarding `--version`
  output. The detection contract is unchanged — "detected" still means the
  process spawned and ran — and the version is additional, best-effort, and
  absent when it cannot be read.
- New `packages/core/src/verified-agent-versions.ts`: the single constant
  naming the `claude` CLI version this project's structured-output
  translation was verified against (ADR 0017 decision 7). Neutral module,
  because it has three consumers: `claude-cli-acp`, the init wizard's
  version check, and usage extraction.
- New `packages/core/src/usage-report.ts`: aggregates audit entries into
  totals by agent, by model and by change, alongside the existing
  `sprint-report.ts`/`change-timeline.ts` reporting modules.
- `packages/extension`/`packages/webui`: a run's cost shown where the run
  already is, when present. Absent where there is no structured source —
  never an estimate (ADR 0017's last rejected alternative).
- `openspec/changes/agentic-harness-init-wizard/tasks.md` task 1.4 updated
  to read the version detection already captured instead of spawning
  `claude --version` a second time (ADR 0017 decision 6). That change is
  unimplemented, so this is an edit to its plan, not to shipped behavior.

## Capabilities

### New Capabilities

(none — this extends `execution-core`)

### Modified Capabilities

- `execution-core`: the audit record gains optional usage and
  observed-agent-version fields; agent detection additionally reports a
  best-effort version; a run's recorded usage is reportable in aggregate.

## Impact

- `packages/core/src/security.ts`, `agent-detection.ts`; two new core
  modules. No change to any adapter, to `spawnAndStream`, or to the
  command/event protocol.
- `packages/extension`, `packages/webui`: presentation only.
- No agent output is parsed by this change. Every extraction site named in
  ADR 0017 arrives with the adapter that produces it.

## Explicitly out of scope

- Extracting usage from any agent (`acp-agent-adapters` and its per-adapter
  follow-ups).
- Changing `claude.ts` off `--output-format text`, or converting any
  raw-text adapter to structured output — forbidden by ADR 0017 decision 2.
- The version-mismatch warning UI itself (`agentic-harness-init-wizard`
  task 1.4 owns it; this change only changes where it sources the version).
