---
"@openspec-ui/webui": minor
---

Chart what a project finished, and what the chart rests on.

Two charts under the multi-change timeline, in both hosts: how many
changes were archived per day, and how long each took from the commit
that proposed it to the one that archived it. Every day between the first
and the last is a column, so a quiet day is a gap rather than a missing
column.

Each chart states what it drew, how many changes it left out for having
no date, and how many of its dates came from a commit rather than from a
folder name — a chart that drops the source plots an inference and a
measurement identically.

Two more charts were measured and deliberately not drawn: the work span
and the wait before work are flat here (135 of 185 changes have exactly
zero days between being proposed and their first finished task), and the
view says so rather than shipping a flat line that reads as a finding.

The multi-change timeline now plots an archived change at the commit that
archived it. The end-of-day anchor remains for the case it was written
for — a date read off the folder name, which carries no time of day.
