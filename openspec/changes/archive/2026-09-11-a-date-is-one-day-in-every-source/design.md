# Design

## Decision: a day is the day where the action happened

A commit records its own offset (`%aI`); the day is taken from that
string before any normalisation, so a commit made at 02:30 in Moscow is
the 27th, as the person who made it would say. `git blame`'s porcelain
output carries the same thing as `author-time` plus `author-tz`, and the
two are read together. A folder name is already a day. Every source
therefore yields the day its own record names, and the chart's per-day
buckets mean "the day someone did it" rather than "the UTC day".

Two corrections to what this said when it was written, found while
implementing it:

- **An audit timestamp carries no offset.** Every writer of one calls
  `new Date().toISOString()`, so it is UTC with a `Z`, and the day read
  from it is the UTC day. That is the day its record names, which is
  the rule above; giving those timestamps an offset would be a change
  to what is written, not to how it is read, and it is not made here.
- **The commit and the folder name are not always the same action.**
  `openspec archive` names the folder with the local day the command
  ran and the commit lands whenever it lands. Two of this repository's
  archives were committed at `00:00:24 +03:00`, twenty-four seconds
  after the day the folder is named for ended. The commit is still the
  measurement and still wins; "every source agrees" is true of one
  action read two ways, and archiving across midnight is two actions.

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
