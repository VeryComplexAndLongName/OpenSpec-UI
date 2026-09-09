Not started. Recorded now because the charts that would use these dates
are coming, and half of what they would be drawn from is a directory
name.

## 1. The dates

- [ ] 1.1 A dated fact is a date and its source, never a bare date.
- [ ] 1.2 `proposed` — the earliest commit that added `proposal.md`, with
  `--follow`, so the archive rename does not reset it. This exists as
  `createdDate`; it gains a source.
- [ ] 1.3 `archived` — the commit that added the change under `archive/`,
  without `--follow`. The `YYYY-MM-DD-` prefix becomes the fallback, and
  says so when used.
- [ ] 1.4 `firstWorked` and `lastWorked` — the earliest and latest of the
  task lines' blame dates and the change's audit entries.
- [ ] 1.5 An undeterminable date is absent with a source saying so, never
  filled in with today's.

## 2. Cost

- [ ] 2.1 Read where the timeline is already read, not per date: two git
  calls per change, and blame that is already being run for the tasks.
- [ ] 2.2 Measure it over this repository's own archive — 50+ changes —
  before and after. A dating pass that makes the timeline unusable is not
  worth its charts.

## 3. Tests

- [ ] 3.1 A change archived by the command dates from the commit, not the
  prefix.
- [ ] 3.2 A change whose directory carries no prefix and no archive commit
  reports the date as absent.
- [ ] 3.3 The prefix is used when there is no commit, and the source says
  so.
- [ ] 3.4 First and last worked are distinct from proposed and archived
  where the task dates differ from both.
- [ ] 3.5 A change that exists only in the working tree has no proposed
  date and says why.
- [ ] 3.6 `--follow` is asserted: an archived change's proposed date is
  the original one, not the archive commit's.

## 4. Verification

- [ ] 4.1 `openspec validate --strict --changes`.
- [ ] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged.
- [ ] 4.3 Run it over this repository and record the table: how many
  changes get each date, and from which source. A dating pass whose
  sources are all `folder-name` has not read the evidence.
