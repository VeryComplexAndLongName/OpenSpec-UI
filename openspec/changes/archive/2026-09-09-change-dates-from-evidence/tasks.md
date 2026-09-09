Recorded first, then implemented. Two defects turned up on the way and
are fixed here; both are noted where they belong.

## 1. The dates

- [x] 1.1 A dated fact is a date and its source, never a bare date.
- [x] 1.2 `proposed` — the earliest commit that added `proposal.md`, with
  `--follow`, so the archive rename does not reset it. This exists as
  `createdDate`; it gains a source.

  **It did not work.** `--follow` combined with `--reverse` makes git
  print nothing at all, so this returned `null` for every file that had
  ever been renamed — every archived change, silently, as
  "undeterminable". Reproduced outside the test suite against git
  2.54.0, fixed by dropping `--reverse` and taking the last line. Before
  the fix all 178 archived changes here had no creation date; after it,
  all 178 do.
- [x] 1.3 `archived` — the commit that added the change under `archive/`,
  without `--follow`. The `YYYY-MM-DD-` prefix becomes the fallback, and
  says so when used.
- [x] 1.4 `firstWorked` and `lastWorked` — the earliest and latest of the
  task lines' blame dates and the change's audit entries.
- [x] 1.5 An undeterminable date is absent with a source saying so, never
  filled in with today's.

## 2. Cost

- [x] 2.1 Read where the timeline is already read, not per date: two git
  calls per change, and blame that is already being run for the tasks.

  The archiving date is not read per change at all in the end. Measured
  at ~450ms per call — 80 seconds across 178 archived changes — against
  0.5s for one call over the whole `archive/` directory, so
  `getChangeTimelines` reads it once and hands it down.
- [x] 2.2 Measure it over this repository's own archive — 50+ changes —
  before and after. A dating pass that makes the timeline unusable is not
  worth its charts.

  185 changes, ~200 seconds, unchanged by this work: the time is the
  per-change `--follow` and blame that were already there. What this
  change adds is one 0.5s call.

  **Found by measuring:** `getChangeTimelines` ran every change through
  `Promise.all` at once and died with `EMFILE: too many open files` at
  185. It reads in batches of 8 now. That was there before this change
  and nothing had asked it for the whole archive.

## 3. Tests

- [x] 3.1 A change archived by the command dates from the commit, not the
  prefix.
- [x] 3.2 A change whose directory carries no prefix and no archive commit
  reports the date as absent.
- [x] 3.3 The prefix is used when there is no commit, and the source says
  so.
- [x] 3.4 First and last worked are distinct from proposed and archived
  where the task dates differ from both.
- [x] 3.5 A change that exists only in the working tree has no proposed
  date and says why.
- [x] 3.6 `--follow` is asserted: an archived change's proposed date is
  the original one, not the archive commit's.

## 4. Verification

- [x] 4.1 `openspec validate --strict --changes`.
- [x] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged.
  Run 2026-09-09: exit 0 — 48 cli, 793 core, 302 extension, 68 server,
  322 webui.
- [x] 4.3 Run it over this repository and record the table: how many
  changes get each date, and from which source. A dating pass whose
  sources are all `folder-name` has not read the evidence.

  Run 2026-09-09 over all 185 changes (178 archived, 7 active):

  | Date | Sources |
  | --- | --- |
  | proposed | `git-commit` 185 |
  | firstWorked | `git-blame` 185 |
  | lastWorked | `git-blame` 185 |
  | archived | `git-commit` 178, `none` 7 (the active ones) |

  `folder-name` answered nothing: every archived change here dates from
  a real commit, and the convention is carried only for a repository
  where one does not exist.
