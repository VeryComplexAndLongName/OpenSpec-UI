## Context

See `proposal.md` for motivation and `docs/adr/0017-structured-agent-output-parsing.md`
for the governing decision. Load-bearing facts, all established by live
investigation on 2026-09-01:

- `claude -p --output-format json` returns, in one object: `total_cost_usd`,
  `usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens`, `output_tokens_details.thinking_tokens`),
  `modelUsage` keyed by model id with a `costUSD` each, `num_turns`,
  `duration_api_ms` and `permission_denials`. A single run's `modelUsage`
  carried two models, so per-run and per-model are genuinely different
  granularities, not the same number twice.
- `AuditEntry` (`packages/core/src/security.ts`) is already per-run and
  per-agent: it carries `runId`, `agent`, `outcome`, `cwd`, `timestamp` and
  an optional `invocation`. `FileAuditLog.record()` writes
  `JSON.stringify(entry)` as one JSONL line, so added optional fields
  persist with no new mechanism and old lines stay readable.
- `detectAvailableAgents()` spawns `<binary> --version` with
  `stdio: "ignore"`. The same file records `copilot --version` at 4.96-6.51 s
  on this machine — the measurement behind detection's 10 s timeout.
- `sprint-report.ts` and `change-timeline.ts` already establish where
  aggregate reporting modules live in `packages/core`.

## Goals / Non-Goals

**Goals:**

- Give a run's usage and observed agent version a durable, per-agent home,
  ready before `acp-agent-adapters` adds four more adapters.
- Make "which runs are billed blind" visible, by leaving the field absent
  rather than estimating it.
- Give the verified-version constant one home before it acquires three
  consumers.

**Non-Goals (this change):**

- Parsing any agent's output. Not one line. Every extraction site arrives
  with the adapter that produces it.
- Changing `claude.ts`, `spawnAndStream`, or any adapter's behavior.
- The command/event protocol. Usage is an audit-record concern, not an
  event kind — see the first decision below.
- Estimating cost for agents with no structured source.

## Decisions

### Usage belongs to the audit record, not to the event protocol

`AuditEntry` already is the per-run, per-agent record, already carries the
`runId` that ties it to a run and the `agent` that answers "by which agent",
and is already persisted as JSONL by `FileAuditLog`. Adding two optional
fields to it yields the requested breakdown with no new storage, no new
transport and no protocol change.

**Rejected alternative**: a new `usage` `EventKind`. Rejected — events are
the live stream a client renders; usage arrives once, at the end, and its
consumer is a report rather than a renderer. It would also oblige
`server`/`extension` to pass through a kind whose only destination is
storage, and would put a vendor-shaped payload into the protocol
`packages/core` defines, which every adapter must then satisfy.

**Rejected alternative**: extend `WorkbenchProcess` (the Processes view's
record) instead. Rejected — that record is scheduler state, reconstructed on
recovery and pruned by retention; audit entries are an append-only ledger.
Cost history must outlive the process rows it describes. The Processes view
can still display cost by reading it, which is one direction of dependency
rather than two homes for one fact.

### The usage shape is this project's own, not the vendor's

A small, adapter-agnostic type: total input/output/cache tokens, an optional
vendor-computed cost in USD, and an optional per-model map. Adapters
translate into it.

**Rejected alternative**: store the vendor's object verbatim. Rejected —
`modelUsage`, `output_tokens_details` and `service_tier` are Claude's
spelling; Copilot and Gemini will differ. A shared shape is what makes "by
agent" comparable at all, and per ADR 0017 decision 5 an adapter that can
fill only part of it fills that part.

**Rejected alternative**: compute cost from tokens and a price table.
Rejected in ADR 0017 — the vendor already prices cache-creation and
cache-read tiers separately and splits per model within one run; a local
table would go wrong silently at the next price change.

### Detection reports a version; it does not gate on one

`detectAvailableAgents()` captures `--version` stdout and extracts a version
token best-effort. Unparseable output means no version, never "not
detected": the existing contract — the process spawned and ran — is
unchanged, and this change must not narrow it.

**Rejected alternative**: a separate version-probe call site. Rejected —
per ADR 0017 decision 6 a second spawn costs 4.96-6.51 s against a value
that changes when a user upgrades a CLI, not between runs. Detection already
pays for exactly this process.

### `agentVersion` is recorded per run, not only at detection time

The version observed at detection is copied onto each run's audit entry.
Detection happens once; runs happen many times, and a CLI can be upgraded
between them.

**Rejected alternative**: store the version once, globally. Rejected — it
would make the audit ledger's own history unreadable: "these forty runs
parsed on 2.1.240" is the evidence ADR 0017 decision 6 wants for widening a
pin, and a single global value cannot express it.

## Risks / Trade-offs

- **[Risk]** The plumbing ships before any producer of `usage` exists, so
  the field is empty until `acp-agent-adapters` lands. → **Mitigation**:
  `agentVersion` has a producer in this change, so the record is exercised
  end to end rather than only by tests; and the split is deliberate — see
  proposal.md, retrofitting across eight adapters is worse than building
  ahead of four.
- **[Risk]** An absent cost may read as "free" rather than "unmeasured". →
  **Mitigation**: the report distinguishes the two explicitly, and a task
  requires it — this is the whole reason estimates were rejected.
- **[Trade-off]** Cost is visible per run and in aggregate, but not live
  during a run: `total_cost_usd` arrives with the final result message.
  Accepted; a live counter would require parsing incremental deltas, which
  is a different and much more drift-exposed problem.

## Migration Plan

Purely additive. Both new `AuditEntry` fields are optional, so audit lines
written before this change stay valid and parseable, and any consumer
reading them keeps working. No configuration changes and nothing to
back-fill: runs before this change simply have no usage, which is accurate.

## Open Questions

None. The version-mismatch warning's own presentation is owned by
`agentic-harness-init-wizard` task 1.4 and is out of scope here.
