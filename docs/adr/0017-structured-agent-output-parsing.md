# ADR 0017: Structured agent output — parsing discipline and graceful degradation

Status: Accepted

Date: 2026-09-01

## Context

`packages/core/src/agents/shared.ts`'s `spawnAndStream` deliberately treats
every CLI agent's output as opaque text — "conservative parsing... does not
attempt to guess a structured format" — so that a CLI's output-format drift
across versions cannot break the event stream. ADR 0013 restates that
property and preserves it deliberately: the raw-text adapters remain the
drift-resistant fallback for a young ACP ecosystem that has already had one
naming churn.

That choice has a cost this project is now paying twice over, both found by
live investigation rather than assumption:

- **Cost and token usage are produced and discarded.** `claude -p
  --output-format json` returns `total_cost_usd`, a full `usage` block
  (input, output, cache-creation, cache-read, thinking tokens) and a
  `modelUsage` map giving cost per model within a single run — verified live
  on 2026-09-01. `packages/core/src/agents/claude.ts` asks for
  `--output-format text`, so none of it arrives. Nobody in this project can
  currently answer what a run cost; the trivial verification run that
  produced the evidence above cost $0.26.
- **Agent versions are produced and discarded.** `detectAvailableAgents()`
  already spawns `<binary> --version` for every agent and passes
  `stdio: "ignore"` (`packages/core/src/agent-detection.ts`), throwing the
  answer away. The same file records why a second spawn would be expensive:
  `copilot --version` measured 4.96-6.51 s on this machine, which is why
  detection's timeout was raised to 10 s.

A narrower exception to the no-parsing rule has already been accepted:
`agentic-harness-init-wizard` task 1.4 parses `claude --version`'s
undocumented plain-text output (`2.1.237 (Claude Code)`) and degrades on
failure — a dismissible warning on mismatch, a silent skip on spawn failure,
never a block. That decision established the shape; this one generalizes it
and states the rules it must obey.

The remaining pressure comes from ADR 0013: after ACP lands, three of four
agents speak a versioned protocol that negotiates capabilities at session
start, while `claude-cli-acp` translates an undocumented, non-versioned
structured surface pinned to one verified CLI version. Three separate places
will then care about "which `claude` version was this verified against":
`claude-cli-acp` itself, the wizard's version check, and usage extraction.

## Decision

### 1. The goal is a version contract, not JSON

Output surfaces are preferred in this order, and an adapter uses the highest
one its agent actually offers:

1. **ACP** — structured *and* version-negotiated at session start.
2. **JSON with a documented schema.**
3. **JSON, undocumented** (`claude --output-format stream-json`) — usable,
   but only with an explicit pinned verified version.
4. **Plain text** — not parsed at all; passed through as today.

JSON alone is a shape; ACP is a shape plus a handshake. Treating them as
equivalent would lose the distinction that makes ACP worth adopting.

### 2. The raw-text adapters are not converted

Today's five raw-text adapters keep `--output-format text` and keep parsing
nothing. Structured extraction belongs to the ACP-flavored adapters, where
structure is the point.

### 3. Parsing never changes a run's outcome

A parsing failure may reduce the information recorded about a run. It may
never fail the run, alter its events, or change its terminal kind. Every
extraction site degrades to the behavior that existed before it, exactly as
`prepareAgentContext`'s rules lookup and the wizard's version check already
do.

Usage in particular arrives in the run's *final* result message, after all
work is done and every event has already been emitted, so a failed parse can
only produce silence.

### 4. The version is a prior, not a gate

Parsing is always attempted. The recorded verified version decides what is
*said* and what is *remembered*, never whether to try:

| | parse succeeded | parse failed |
|---|---|---|
| **version matches pinned** | normal, silent | **loud** — not version drift; a defect worth reporting |
| **version differs** | works: record that it also parsed on this version | degrade, name both versions, warn once per version per session |

Gating on version equality would degrade where nothing is wrong — most
version bumps do not change output shape — and would still miss the
top-right cell, which is the most alarming of the four and today has nowhere
to be reported.

### 5. Degradation is per field, in steps

| level | what survives |
|---|---|
| 1 | ACP session: structured events + usage + permission requests |
| 2 | JSON parses, no protocol: events + usage, no permission gate |
| 3 | Envelope parses, a field is missing or renamed: keep what parsed, drop only what did not |
| 4 | Nothing parses: today's passthrough, no usage |

Level 3 carries the weight. Typical drift is one renamed field; an
all-or-nothing parse discards the nine that were fine along with it.

### 6. Versions are captured for free, and recorded per run

The observed agent version is taken from surfaces already being paid for —
detection's existing `--version` spawn, and ACP's session handshake — never
from a per-run spawn. Each run records the version observed alongside its
usage, so widening a pin becomes a measurement ("forty runs on 2.1.240, all
parsed") rather than a guess.

### 7. One verified-version constant, in a neutral module

The constant naming the `claude` CLI version the structured-output
translation was verified against lives in its own module in `packages/core`,
not inside any one of its consumers. It has three: `claude-cli-acp`, the
init wizard's version check, and usage extraction.

## Rejected Alternatives

**Gate parsing on an exact version match.** Rejected — it degrades where
nothing is wrong, and it cannot detect the version-matches-but-parse-failed
case at all. `agentic-harness-init-wizard`'s design already rejected the
harder form of this (blocking until versions match) for the same reason.

**Convert the raw-text adapters to JSON too.** Rejected — it would remove
the drift-resistant fallback ADR 0013 preserved on purpose, precisely when a
young ACP ecosystem might need it. If both variants parse structure, there
is no fallback left.

**All-or-nothing parsing: any unrecognized field discards the record.**
Rejected — see decision 5; it throws away good data to punish one renamed
key.

**Compute cost ourselves from token counts and a price table.** Rejected —
the vendor already computes `total_cost_usd`, including cache-creation and
cache-read tiers and per-model splits within one run. A local price table
would be wrong the first time pricing changed, and wrong silently.

**Spawn `--version` per run to keep the version fresh.** Rejected — measured
at 4.96-6.51 s for `copilot` on this machine (recorded in
`agent-detection.ts`), against a value that changes when the user upgrades a
CLI, not between runs.

**Record a usage estimate for agents with no structured source.** Rejected —
an absent field is honest and makes visible exactly which runs are billed
blind. An estimate would be indistinguishable from a measurement in the same
report.

## Consequences

- `AuditEntry` gains optional usage and observed-version fields.
  `FileAuditLog` already serializes entries as JSONL, so persistence follows
  with no new mechanism.
- Runs whose agent has no structured source report no usage, permanently and
  visibly, rather than a fabricated number.
- `detectAvailableAgents()` stops discarding `--version` output. Its
  contract ("detected" means the process spawned and ran) is unchanged; the
  version is additional, best-effort, and absent when unparseable.
- The init wizard's task 1.4 should read the version detection already
  captured rather than spawning `claude --version` a second time.
- Related OpenSpec change: `openspec/changes/agent-usage-accounting/`.
