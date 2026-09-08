## Why

A run's spending is visible while it happens and gone once it ends.

The usage summary reads the event stream, so it can show a row per stage
with money, tokens and elapsed time. Events are not kept. The audit log
is kept — it now records the stage and the effort each run was asked for
— and nothing reads it back for a person.

So the question a person actually asks after the fact has no answer in
the product: *what did this change cost, and where did it go?* Answering
it today means opening `.openspec-ui/audit.jsonl` and grouping JSON lines
by hand.

That question is asked in two situations, and neither is idle curiosity.
One is a change that finished and cost more than expected — the reader
wants to know which stage did it. The other is a change that did **not**
finish: it was cut, it failed, its attempts ran out. That reader wants to
know how much was spent on something that produced nothing, which is
exactly the case a live panel cannot answer because the panel is gone.

There is a second use, which the later recommendation work depends on
entirely: a budget suggested from what comparable changes actually cost
is worth something, and one suggested from a guess is not. That reads the
same records.

## What Changes

- A report for one change: a row per stage with the agent, the effort it
  was asked for, what it reported spending, and how long it ran, plus a
  total.
- Reachable for any change, whether it finished or not, and whether it is
  active or archived — the audit log survives both.
- A figure the agent never reported is shown as **not reported**, never
  as zero. Six of the ten supported agents report nothing at all, and a
  report that showed them spending `$0.00` would be lying in the place a
  reader trusts most.
- A stage that older records cannot be attributed to is shown as
  unattributed rather than folded into a stage it might not belong to.

## Capabilities

### Modified Capabilities

- `agentic-harness`: what a change cost can be read after the run, broken
  down by stage.

## Impact

- `packages/core`: a reader over the audit log. `packages/extension`: a
  command on a change in the Changes and Archive trees. Changeset for
  `core` and the extension.

## Explicitly out of scope

- **A cost per task.** Usage is reported per run, and a stage hands its
  whole task list to one agent, so there is nothing to attribute. This is
  the same boundary the per-stage ceiling ran into, and it moves when a
  section of a task list becomes a run of its own.
- **Estimating what was not reported.** A token count multiplied by a
  price table is a number this project already rejected (ADR 0017): it is
  silently wrong at the next price change, and wrong in a way nobody
  notices.
- **Comparing changes to each other.** The recommendation that reads
  these records is a later change; this one produces the record a person
  reads.
