Two sources answer "which day" differently; one source is unreachable;
one bad folder name breaks the request; a sentence about this repository
is shown to everyone.

## 1. One day for one action

- [ ] 1.1 `packages/core/src/change-dates.ts`: a `DatedFact` carries the
  instant with its offset as recorded, and a `day` taken from that
  string before normalisation. Every reader of `slice(0, 10)` reads
  `day` instead: `change-timeline.ts:362`, the sprint report, the
  timeline view, the per-day chart.
- [ ] 1.2 The folder-name source stamps its day without an offset and
  its `day` is the prefix.
- [ ] 1.3 A test with a commit at `02:30+03:00` asserting the day is the
  27th from the commit source and from the folder source alike.

## 2. The audit-log source reaches the hosts

- [ ] 2.1 `getChangeTimelines` accepts audit timestamps per change; the
  server route and the extension command read the audit log once per
  request and pass them.
- [ ] 2.2 A test through `getChangeTimelines` where a run precedes the
  first ticked task, asserting `firstWorked.source === "audit-log"`.

## 3. Never throws

- [ ] 3.1 One parse helper in `change-dates.ts` returns absent for a
  string `Date` cannot read, with source `unreadable`; every source
  parses through it.
- [ ] 3.2 A test with `archive/2026-13-01-typo` and no commit: the
  timeline is returned, the archived date is absent, and its source says
  why.

## 4. The archive read reads what git prints

- [ ] 4.1 `readArchiveCommitDates` uses a delimiter that cannot appear
  in a path, resolves paths against `git rev-parse --show-toplevel`, and
  handles `core.quotePath` output or disables it with `-c
  core.quotePath=false`.
- [ ] 4.2 It returns the count of lines it could not read beside the
  map, and `getChangeTimelines` reports that count in the timeline's
  basis so a silent fallback becomes a visible one.
- [ ] 4.3 A test with the workspace under a directory named `Core`.

## 5. Chart arithmetic in core

- [ ] 5.1 Move `archivedPerDay`, `leadTimes`, `LEAD_BUCKETS`,
  `describeBasis` and their tests from `packages/webui/src/change-charts.ts`
  to a leaf module in core exported through `browser.ts`. The webui
  component imports them.
- [ ] 5.2 Add `describeWorkDurationNotCharted(timelines)` in the same
  module: how many changes, how many with zero days from proposal to
  first finished task, and the threshold. `ChangeChartsView.tsx` renders
  it in place of the constant sentence.
- [ ] 5.3 Rename the lead-time buckets by their boundaries.
- [ ] 5.4 Move `readOpenTaskCount` from
  `run-with-harness-dispatch.ts` to core beside the task checklist.

## 6. Tests that reach what they name

- [ ] 6.1 `change-timeline.test.ts`, the folder-name case: commit the
  archive on a different day from the folder's, or without a commit,
  and assert `dates.archived.source === "folder-name"`.

## 7. Verification

- [ ] 7.1 `openspec validate --strict --changes`.
- [ ] 7.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run.
- [ ] 7.3 Version bump via `npx changeset` for core, webui, server and
  the extension.
- [ ] 7.4 Render the charts over this repository and look at them, as
  `charts-of-what-was-finished` did; confirm the two early-morning
  archives moved to the day their folders say.
- [ ] 7.5 **Human-only**: open the timeline in VS Code over this
  repository and confirm the sentence under the charts gives this
  repository's own figures.
