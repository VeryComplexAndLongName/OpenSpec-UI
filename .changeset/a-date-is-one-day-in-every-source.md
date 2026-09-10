---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

A change's date now carries the day its own record names, alongside the
instant. A commit records its offset and `git blame`'s porcelain output
records it too; the day is read from that string before any
normalisation, so an archive committed at `02:30 +03:00` is that day
rather than the previous one in UTC. The instant is still normalised, so
ordering and lead times are unchanged. The archived date shown in the
sprint report, the timeline and the per-day chart is that day.

The audit log reaches both hosts. `getChangeTimelines` takes the
timestamps of the runs recorded against each change, and the server
route and the extension's timeline command each read the log once per
request and hand them down — so work that began with a run before anyone
ticked a task is dated from that run in a workspace, not only in a test.

A date that cannot be read is now absent and says so. One folder named
`2026-13-01-something` used to throw out of the whole multi-change
request, taking every other change's dates with it.

The one-call archive read no longer mistakes a path for a date. It told
them apart by a leading `C`, and `--name-only` prints paths relative to
the repository root, so any workspace under a directory beginning with
`C` fell back to a git call per change without saying so. It reports the
lines it could not read, and the chart's basis line says when there were
any.

The chart arithmetic moved from `webui` into core, exported through
`@openspec-ui/core/browser`, so a host showing the same figures in
another form draws them from the same functions. The lead-time buckets
are named by their boundaries — "Under a day", "1–2 days", "2–3 days",
"3–8 days", "8 days or more" — rather than by "Same day", which a
twenty-four-hour floor does not mean. The sentence explaining the
work-duration chart that is deliberately not drawn is computed from the
changes on screen; it used to state "measured over this repository, 135
of 185 changes…" in every workspace.
