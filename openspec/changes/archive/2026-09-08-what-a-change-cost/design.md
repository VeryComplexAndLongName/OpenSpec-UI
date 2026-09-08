# Design

## Context

Read on 2026-09-08, after `stage-spend-is-bounded-and-recorded` landed.

- An `AuditEntry` carries `runId`, `agent`, `outcome`, `timestamp`,
  `changeDir`, and optionally `usage`, `agentVersion`, `reason`, and now
  `stage` and `effort`.
- `AuditOutcome` is `blocked | started | completed | failed | cancelled`.
  A run writes a `started` entry and one terminal entry.
- Every stage of a chain shares the chain's `runId` (ADR 0012). `stage`
  is what separates them.
- `usage` absent means the agent reported nothing. It is never zeroed —
  `agent-runner.ts` says so where it collects it.
- The audit log persists across restarts (`audit-log-persistence`), so a
  change archived days ago still has its records.

## Decision: duration comes from the records already written

No new timing field. A run writes `started` and a terminal entry, both
timestamped, so its duration is the difference — for stages as well as
runs, now that both entries carry `stage`.

The pairing has to survive a stage that ran twice. A chain that returned
from `verify` to `apply` has two `started` entries and two terminal
entries with the same `runId` and the same `stage`. So pairs are matched
in order: each `started` with the next terminal entry for the same
`runId` and `stage`. An unpaired `started` — a run that never ended,
because the editor closed mid-run — is reported as still running rather
than given an end time it did not have.

## Decision: absent is "not reported", everywhere, in every column

Six of the ten supported agents report no usage. A report that showed
them at `$0.00` would be lying in exactly the place a reader trusts, and
this project has already made that decision once, for the live panel,
which never prints `$0.00` for an agent that reported nothing.

The same applies to a total: a change whose stages half-reported has a
total over *what was reported*, labelled as such. Summing reported
figures and presenting the result as the change's cost would quietly
claim the silent stages were free.

## Decision: an unattributable record is shown, not hidden or guessed

Records written before `stage` existed have none. They belong to the
change — `changeDir` says so — but not to any row.

They appear as an "unattributed" line rather than being dropped or
folded into a stage. Dropping them makes the total wrong; folding them
into a guessed stage makes a row wrong. Showing them keeps the total
right and says exactly what is not known, which is the honest shape and
also the one that stops someone re-deriving the missing attribution from
timestamps later.

## Decision: the report is a core function, rendered by the host

`packages/core` produces the structure; the extension renders it. This is
the split ADR 0001 requires, and it also means the recommendation work
later reads the same function rather than a second implementation that
drifts from it.

## Decision: offered on any change, finished or not

The command is offered on a change in both the Changes and Archive trees,
with no condition on state. A change that failed halfway is the case
where the question is most pressing — money was spent and nothing shipped
— and a command that appeared only on successful changes would be absent
exactly then.

A change with no records at all is not an error: it means nothing has run
against it. The report says that rather than showing an empty table.

## Rejected: a new persisted "report" artifact

Writing a summary file at the end of a run would need somewhere to live,
would go stale when a later run added to the change, and would be one
more thing to keep consistent with the log it came from. The log is
already the record; the report is a view of it, computed when asked.

## Rejected: deriving cost from tokens where cost is missing

ADR 0017 rejected local price tables: they are silently wrong at the next
vendor price change, and wrong in a direction nobody notices. A token
count with no cost stays a token count.

## What this does not decide

How the report is shown — a document, a panel, a text summary. The
structure is what this change fixes; the extension renders the first
version of it, and a different surface later reads the same function.
