# ADR 0053: Usage is accounted per agent invocation

Status: Accepted

Date: 2026-10-24

## Context

A chain shares runId across stages, retries, and review/update calls. Usage
aggregation grouped by that id and retained only its first report, silently
undercounting both CLI summaries and the Harness's recorded spending.
Codex ACP model selection also bypasses argv, so audit omitted its request.

## Decision

1. Keep runId as the public chain/control identity. Give each runner call a
   fresh optional audit invocationId, shared by its started and terminal
   entries. Record requestedModel separately from provider-reported usage.
2. Aggregate measured invocations, retaining distinct logical-run counts.
   Pair legacy start/terminal entries in recorded order; do not collapse
   repeated terminal usage merely because the stage or runId is the same.
3. Preserve unknown money as absence and expose coverage. Reported zero is
   a measurement. Keep token categories separate and currencies separate,
   extending ADR 0017's per-field degradation without local estimates.
4. Preserve Codex ACP's model metadata as vendor-reported current-model
   attribution. Do not claim it is an exact multi-model split or infer an
   actual model from a requested model or today's configuration.
5. Resolve historical cost reads in core by change identity, independently
   of active task lists. Refuse ambiguous reused names and retain the
   existing repository audit-reader boundary.

## Rejected Alternatives

- New runId per stage: breaks chain controls and existing log correlation.
- A key of runId plus stage: still discards retries and review/update calls.
- Zero-seeded USD totals: makes unreported cost appear free.
- Price tables or inferred old models: replace missing evidence with guesses.
- A new history-event model: change history records ownership and workflow;
  resource reporting belongs to run audit.

## Consequences

Old JSONL remains readable. New optional usage fields pass through the
existing event transports. CLI JSON omits previously fabricated zero USD
and adds measured-invocation/coverage information. Existing token-ceiling
semantics and fail-open behavior for unknown spend are unchanged.
