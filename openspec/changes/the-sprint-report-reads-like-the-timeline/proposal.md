## Why

The owner reported on 2026-09-21 that the Sprint Report does not
generate. After a click the machine sits at 100% for a long time. Then
nothing happens, and the button can be pressed again.

Two faults, measured the same day on this repository:

- **The tab was opened too late.** The standalone opened the report's tab
  after the request came back. A browser lets a page open a tab only
  while it is answering a click, and by then the click was minutes old.
  The tab was refused, and the wait ended in nothing. The code's own
  comment said the window was "opened from the click that asked for it".
  It was not.
- **The report read every change at once, and the slow way.**
  `buildSprintReport` started a timeline and an authorship read for every
  selected change together, not in batches. Each timeline asked git for
  its archive date on its own. A whole workspace was discovered on top.
  The Timeline tab had already been fixed for the same reads: batches of
  eight, and one git call for the archive's dates, measured at 0.5 s
  against 80 s. The report never used that path. Over the whole archive
  (296 changes) it took **109 s of wall time and 65 s of processor**. At
  100 changes it took 32 s, and at 20 it took 4.6 s.

## What Changes

- **The report reads like the timeline.** Timelines come from
  `getChangeTimelines`: in batches, with the archive's dates read once.
- **Every change's authorship comes from one git call.** The new
  `readChangeAuthorships` reads this repository's whole history of
  `openspec/changes` in about 0.3 s. Asking once per change cost 8.6 s
  per 100 changes. It counts
  the same commits as the per-change call. Checked over all 296 changes
  here: the one difference is a real commit to one change's directory
  that git's history simplification had hidden from the per-change call.
  When the one call cannot be made, each change is asked as before.
- **Every proposal's first commit comes from one git call.** The new
  `readProposalCreatedDates` follows renames itself, the way `--follow`
  does, over one `git log -M --diff-filter=AR` of `openspec/changes`:
  0.6 s here, where `--follow` once per change was about 0.4 s each and
  most of a timeline's read. Checked against the per-change call over all
  297 proposals here: no difference. A change it does not know is asked
  on its own. `getChangeTimelines` uses it, so the Timeline tab's
  comparison gains too.
- **The tab opens from the click.** It says how many changes it is
  reading, and becomes the report when the answer comes. On a failure it
  shows the failure instead of closing.
- **The editor says it is reading.** The VS Code command shows a
  progress notification while the report is built.

Measured after the change, same machine: 296 changes in 26 s of wall
time and 13 s of processor, against 109 s and 65 s; the 66 changes of the
last week in 6.8 s.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - how the sprint report reads its changes.
- `standalone-app` - when the report's tab opens.
- `vscode-extension` - what the sprint report command says while it reads.

## Impact

- `packages/core/src/sprint-report.ts`, `packages/core/src/change-timeline.ts`
  (`readChangeAuthorships`, `readProposalCreatedDates`, `TIMELINE_BATCH`
  exported).
- `packages/webui/src/sprint-report-page.ts` (`renderSprintReportNotice`),
  `packages/webui/src/standalone-entry.tsx`.
- `packages/extension/src/commands.ts`.
- A browser spec, `packages/server/e2e/sprint-report.spec.ts`.
- A changeset: core, webui, server and the extension change.

## Explicitly out of scope

- **Blame.** A change's timeline still blames its task list once per
  change, for when each item was ticked. That is most of what is left.
  One call cannot answer it for many files.
