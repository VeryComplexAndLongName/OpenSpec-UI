---
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
---

The run dialog shows what runs have cost in this workspace: per agent,
with the median and p90 cost and duration, how many runs each figure
rests on, and how many of those reported a cost at all. An agent that
reports nothing says so rather than showing a cost of zero, and a group
resting on fewer runs than the threshold is marked rather than omitted.

A workspace with nothing recorded says so and states how many audit
entries were read, so the box changes as runs accumulate instead of
looking identical before and after one has happened.

New route `POST /api/workspace-run-stats`, since the figures come from
the audit log and from which changes still exist, and the browser can
read neither.
