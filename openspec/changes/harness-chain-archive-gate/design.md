## Context

See `proposal.md` for the incident and the two-meanings-of-"done"
confusion behind it. This change enforces a contract ADR 0012 already
states rather than establishing a new one, so it needs no ADR of its own.

Three call sites matter: `normalizeStatusResult()`
(`openspec.ts:349-357`), which fabricates the misleading value;
`determineStartStage()` (`harness-chain-runner.ts:79-91`), which reads
it to choose the first stage; and the archive branch
(`harness-chain-runner.ts:~318`), which currently has no precondition at
all.

## Goals / Non-Goals

**Goals:**

- A chain's stage choice and its permission to archive both rest on
  actual task completion.
- An unknown signal never selects the irreversible stage.

**Non-Goals (this change):**

- Gating `apply` on "did the agent actually change anything". Tempting,
  and it would catch a related failure earlier — but it is measured by
  task marking, and this repository has just observed agents on cheaper
  models doing the work correctly and marking **nothing**
  (`harness-step-models` section 8: correct code and tests, zero
  checkboxes touched). Gating on that signal would stop legitimate runs.
- Teaching the harness to tell "the agent did nothing" from "the agent
  did the work and did not record it". That needs a real observation
  channel — `acp-agent-adapters`' structured events — not a heuristic.
- Changing the manual `Archive Change` command, or upstream
  `openspec archive`, which validates spec deltas and is right not to
  duplicate task bookkeeping.

## Decisions

### Absent progress becomes absent, not a fabricated zero

`normalizeStatusResult` currently invents `progress` from artifact
presence when the CLI omits it. The invented value is
indistinguishable from a real "everything is done", which is precisely
how a chain skipped `apply` twice. Make `progress` optional on the
result type and let callers decide what to do without it.

**Rejected alternative**: keep synthesizing, but from `tasks.md` instead
of artifacts. Rejected — `statusChange()` is a thin wrapper over the CLI;
having it parse a file the CLI did not report would make its result a
mix of what the tool said and what we guessed, with no way for a caller
to tell which. The parsing belongs where the decision is made.

### The chain counts tasks itself, and fails safe

`determineStartStage()` reads the change's `tasks.md` checkboxes. If it
cannot determine progress at all, it returns `apply` — the reversible
stage. Choosing `archive` under uncertainty is what caused the incident;
choosing `apply` under uncertainty costs at worst one redundant run.

**Rejected alternative**: fail the chain when progress is unknown.
Rejected — it would stop legitimate chains on any change whose status
shape this product does not recognise, converting a recoverable
uncertainty into a hard stop.

### Gate before `archive`, not after `apply`

The archive stage is where the irreversible act happens and where the
precondition is unambiguous: no unchecked tasks. Checking there covers
every path in — a chain that ran `apply` first, and one that started at
`archive` — with one check.

**Rejected alternative**: compare task counts before and after `apply`
and stop if unchanged. Rejected for the false-positive reason in
Non-Goals, and it would miss a chain that starts at `archive`, which is
exactly how the incident happened.

### Fail the chain, do not skip the stage

The chain emits `failed` with the count and stops. Skipping `archive`
while reporting overall success would leave the user believing the chain
finished its work.

**Rejected alternative**: emit `stageCompleted` for a skipped `archive`.
Rejected — `stageCompleted` means that stage did its job; reusing it for
"did not run" is the same conflation of meanings that caused this
incident one layer down.

## Risks / Trade-offs

- **[Trade-off]** Chains can no longer archive changes carrying a
  human-only task — which, by this repository's convention of marking
  live smoke tests that way, is most substantial changes. Accepted, and
  arguably the point: `config.yaml`'s archive guidance already says not
  to archive a change whose scenarios were not actually verified.
- **[Risk]** An agent that marks tasks it did not do passes the gate —
  it reads the same file the agent writes. → **Mitigation**: none within
  this change, stated plainly rather than implied. It narrows the failure
  from "archived with nothing done" to "archived with false
  bookkeeping" — smaller and more visible, but not zero. Closing it needs
  the observation channel named in Non-Goals.
- **[Risk]** Making `progress` optional touches every caller that reads
  it. → **Mitigation**: the type change makes them fail to compile, so
  none can be missed silently; the Processes view's percent-complete is
  the known one.

## Migration Plan

No migration. A type becomes optional, one decision reads a different
source, one precondition is added; no config, no protocol, no persisted
state.
