# A date is one day in every source

## Why

Found by the code review of 2026-09-10. The dates were built so that a
chart could say where each one came from. Two sources answer the same
question with different days, and one source cannot answer at all.

**A commit and a folder name disagree about the day.** A commit date is
an instant, normalised to UTC and sliced to a day
(`packages/core/src/change-timeline.ts:362`); a folder-name date is the
local day of whoever archived, stamped as UTC midnight
(`change-dates.ts:107`). `2026-08-27-add-stale-task-detection` was
archived by a commit at `02:30 +03:00` on the 27th; normalised, that is
the 26th at 23:30 UTC, so its archived date reads `2026-08-26` in the
sprint report, the timeline and the per-day chart, while its folder says
the 27th. Two of this repository's ninety-one archive commits fall in
that window; every workspace in a positive-offset timezone has the same
band each night. Before this range `archivedDate` was always the folder
prefix, so the field changed meaning for those changes without anyone
deciding it should.

**The audit-log source is unreachable.** `getChangeTimeline` accepts
`options.auditTimestamps` (`change-timeline.ts:285`); `getChangeTimelines`
has no way to pass it (`:380-405`), and it is the only production entry
from either host. `firstWorked.source === "audit-log"` occurs in two test
files and nowhere a person can see. The archived design of
`change-dates-from-evidence` and its ticked task 1.4 say otherwise.

**One malformed folder name fails the whole request.** `ARCHIVE_PREFIX`
accepts any two digits for month and day, and `new Date("2026-13-01T…")
.toISOString()` throws through `buildChangeDates`, `getChangeTimeline`
and `getChangeTimelines`. A hand-moved folder with a typo, and no commit
to date it by, makes every multi-change timeline and the sprint report
reject. The module's header still promises it never throws.

**The one-call archive read silently falls back.** `readArchiveCommitDates`
tells a date line from a path line by `line.startsWith("C")`
(`change-timeline.ts:185`). `--name-only` prints paths relative to the
repository root; a workspace under a directory whose name begins with
`C` turns the path into a date, the parse throws inside the `try`, and
the map is returned short. Every affected change then falls through to
the per-change call the comment measured at 80 seconds, with the source
still correct — a regression nothing reports.

**The chart claims a fact about this repository to every user.**
`ChangeChartsView.tsx:243-247` says "measured over this repository, 135
of 185 changes have exactly zero days…" as a constant, rendered in every
workspace. A user of another repository reads "this repository" as
theirs. The basis line beside it is computed; this one is not.

**The chart arithmetic lives in webui.** `archivedPerDay`, `leadTimes`,
`LEAD_BUCKETS` and `describeBasis` (`packages/webui/src/change-charts.ts`)
are pure computation over core's timeline — the shape core already hosts
as leaf modules through `browser.ts`. The sprint report on the server
would have to duplicate them to show the same numbers.

Smaller, same feature: the "Same day" bucket is a floor of one day, so
sixteen hours across midnight is "same day" (`change-charts.ts:102-108`);
and the timeline test named for the folder-name path commits the archive
at exactly the folder's date, so it passes from the commit path and never
reaches the fallback (`change-timeline.test.ts:383`).

## Capabilities

### Modified

- A date's day is the day where the action happened, whichever source
  it was read from.
- The audit-log source reaches every host.
- A date that cannot be parsed is absent, never an exception.
- Chart arithmetic lives in core; a chart's text about its basis is
  computed from the data it drew.

## Out of scope

Charting how long the work itself took. It was measured flat and the
decision not to draw it stands; only the sentence saying so changes, to
be computed from the workspace shown.
