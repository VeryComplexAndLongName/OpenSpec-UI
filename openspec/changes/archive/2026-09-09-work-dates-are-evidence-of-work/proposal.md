# When work happened is a finished task, not a written one

## Why

`change-dates-from-evidence` shipped `firstWorked` and `lastWorked` from
every blame date on `tasks.md`. Measured over this repository's 185
changes the day after, the metric they exist for is dead:

```
before work (proposed -> first worked): median 0.00d, p90 0.00d, max 0.00d
```

Always exactly zero, for every change. `tasks.md` is added by the same
commit that adds `proposal.md`, so the earliest blame date on it *is* the
proposal date, and any line surviving from that commit keeps it. The
field reported the proposal date under a different name.

It also made the audit log unreachable. `firstWorked` takes the earliest
of the two sources, and a run always happens after the file exists, so
the blame date won every time — 24 changes carry recorded runs and none
of them could ever contribute.

The same measurement, taken over **ticked** tasks instead:

```
before work, by first ticked task: median 0.00d, p90 0.18d, max 2.06d
working, first ticked -> last ticked: median 0.00d, p90 1.10d, max 5.40d
```

Alive, and about work. Every one of the 185 changes has at least one
ticked task, so nothing is lost by the narrowing.

## Capabilities

### Modified

- Evidence of work is a task that was finished or a run that was
  recorded, not a line that was written.

## Out of scope

The charts these dates are for. They come next, and this is the
correction that has to land before anything is drawn from the field —
a chart of a metric that is always zero is worse than no chart, because
it looks like an answer.
