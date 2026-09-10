# Design

## Decision: a day is the day where the action happened

A commit records its own offset (`%cI`); the day is taken from that
string before any normalisation, so a commit made at 02:30 in Moscow is
the 27th, as the person who made it would say. A folder name is already
that day. An audit timestamp is written by this application in the
machine's local time and carries an offset too. Every source therefore
yields the same day for the same action, and the chart's per-day buckets
mean "the day someone did it" rather than "the UTC day".

The full instant is kept beside the day, with its offset, for ordering
and for lead times. Only the day changes meaning; a comparison between
two instants is unaffected.

The alternative — normalising everything to UTC, including the folder
name — makes the folder-name source wrong for anyone east of Greenwich,
and a source that is wrong by a day for a whole timezone is worse than
two sources agreeing on what a person would say.

## Decision: the hosts pass what they have

`getChangeTimelines` takes the audit timestamps per change the way the
single-change function does, and both hosts read the audit log once for
the whole request — the server already reads it for the run statistics.
A workspace with no audit log passes nothing and the source stays
git-blame, which is what happens today.

## Decision: an unparseable date is an absent date

`buildChangeDates` parses through one helper that returns `undefined`
for a string `Date` cannot read, and the source says "unreadable". The
helper is used for every source, so the promise in the module header —
never throws — is kept by construction rather than by each caller.

## Decision: the archive read parses what git prints

`readArchiveCommitDates` uses a delimiter that cannot occur in a path
between the date and the file list, and resolves paths against the
repository root reported by `git rev-parse --show-toplevel` rather than
assuming the workspace is that root. A line it cannot read is counted,
and the count is returned beside the map so the fallback is visible.

## Decision: chart arithmetic moves to core

`change-charts.ts` becomes a leaf module in core exported through
`browser.ts`, with its tests. The webui component draws what it is
given. The sentence about the work-duration chart is computed from the
timelines shown: how many changes, how many with zero days between
proposal and first finished task, and the threshold below which the
chart is not drawn. On this repository it says what it says today; on
another it says what is true there.

The lead-time buckets are named by their boundaries — "under a day",
"1–2 days" — rather than by a phrase that implies a calendar day.
