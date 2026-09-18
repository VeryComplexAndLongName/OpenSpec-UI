---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": patch
---

A blocked change says so in the Changes views

Reported by DW: the Changes view marked a change ready while the Change
Graph showed it blocked by another that was still active. The graph, the
readiness reading and the command line all read `blocked_by`; the two
Changes views asked core for a change's word without that fact, and core
only ever considers Blocked when it is given, so every unfinished change
fell through to Ready.

Both views now read readiness and pass it, and the word names what blocks
the change: "Blocked by apply-plan-stays-pending", with "and N more" past
the first. A change whose tasks are all ticked and whose blocker is still
active says Done with Blocked beneath it, rather than one fact hiding the
other. A test reads one workspace as a listing and as the graph and fails
where they disagree.
