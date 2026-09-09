# Two charts over what actually happened

## Why

The dates exist and nothing draws them. They were built for this, and
until something plots them the only way to see the shape of a project's
work is to read 185 directories.

Which charts is not a matter of taste here — it was measured before it
was decided. Over this repository:

| Question | What the data says | Chart? |
| --- | --- | --- |
| What was finished, and when | 178 changes archived across 19 days, up to 24 in one day | Yes |
| How long a change takes | median 0.22d, p90 3.14d, max 10.17d | Yes |
| How long the work itself took | median 0.00d, p90 1.10d | No — same day for most |
| How long a change waits before work starts | 135 of 185 are exactly zero | No |

The last two would be flat lines presented as findings. They are left
out, and this says so rather than shipping a chart that looks like an
answer.

## Capabilities

### New

- What a project finished and how long its changes took is readable as a
  chart, in both hosts, with what each figure rests on stated beside it.

### Modified

- The multi-change timeline plots an archived change at the moment it
  was archived, rather than at the end of that day.

## Out of scope

Cost and duration charts. `.openspec-ui/audit.jsonl` carries them, the
run figures already summarise them, and mixing "what a run cost" into a
view about when changes happened would answer two questions in one
picture.

A chart of the work span. Measured, flat, and left out deliberately —
see the table above.
