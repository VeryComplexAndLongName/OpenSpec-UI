# Design

## Context

Measured 2026-09-08 from this repository's own audit log:

- 22 changes carry any record. **13 have exactly one run.**
- **16 of 22 have no run that reported a cost at all.** Two have three or
  more.
- Pooled across all changes there are 49 durations and 16 costs, which is
  what the templates' ceilings were drawn from.

Available about a change without any history: its task list — how many
tasks, how many still open — and which artifacts exist.

## Decision: recommend a template, never a number

This reverses the plan's wording, which said "a budget suggested from
what comparable changes actually cost". The data above will not carry it.

Choosing among three named intents is a far weaker claim than proposing a
figure, and it degrades gracefully: with no history at all there is still
a defensible answer, because the templates' own ceilings come from the
pooled distribution rather than from this change.

A number would not degrade. Drawn from one observation it is arithmetic
wearing the costume of evidence, and it would be believed precisely
because it looks computed.

## Decision: the reasons are shown, always

Every recommendation carries the observations behind it, and they are
shown with it — not on request.

A recommendation whose grounds are hidden cannot be disagreed with, only
accepted or ignored. Showing "31 tasks, none done, no previous run" lets
a person see immediately whether the recommender understood their change,
and the cases where it has not are exactly the cases where its answer is
worst.

## Decision: thin evidence is stated, not padded

Where a change has no history, the recommendation says so in the same
place it gives its answer.

The alternative — presenting a default silently — makes "we know nothing
about this change" indistinguishable from "we looked and this is what it
suggests". That distinction is the whole difference between a
recommendation and a decoration, and this project has already drawn it
twice: for a spend that was not reported, and for a ceiling that cannot
act.

## Decision: what is actually read

Only things that exist for every change:

- **Open task count.** A change with thirty open tasks is a long run; one
  with three is not. This is the strongest signal available without
  history, and it is exactly what `determineStartStage` already trusts to
  decide where a chain begins.
- **Whether it has run before, and how those runs ended.** A change whose
  previous run was cut by a ceiling, or whose attempts ran out, wants
  more room rather than the same again. This reads the report from
  `what-a-change-cost` — one function, not a second implementation.
- **Nothing else.** Not the diff size, which does not exist before
  `apply`; not the spec delta count, which says little about cost.

## Decision: a change that overran gets more room, once

A change whose last run ended at a ceiling is recommended the next
template up — Thrifty to Careful, Careful to Overnight — and the reason
says which ceiling it hit.

It does not escalate repeatedly. Twice cut at Overnight is not a case for
a bigger ceiling; it is a case for a person, and the recommendation says
that rather than proposing something larger again.

## Rejected: comparing against similar changes

The obvious design — find changes like this one, average what they cost —
needs both a notion of similarity and enough history per change. Neither
exists. Thirteen of twenty-two changes have a single run, so any
"similar" set would be a handful of single observations, and the
similarity itself would be guessed from task counts that are already used
directly.

## Rejected: recommending on the Run dialog only

The recommendation belongs where the configuration is chosen, which is
also where the templates and the diagnostic already are. Putting it only
in a run dialog would mean the settings view — where someone deliberately
goes to configure — is the one place that does not help.

## What this does not decide

Whether the recommendation should be offered before a first run of a
brand-new workspace, where even the pooled distribution is empty. The
templates' constants still apply there, but whether to say "recommended"
about something no measurement in this workspace supports is a question
about a case that has not arisen here.
