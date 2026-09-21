## Why

The owner reported on 2026-09-21 that "Changes in this sprint", where the
Sprint Report's changes are chosen, shows only two changes at a time. It
was a multiple select over every change in the workspace, 300 of them
here. Choosing a sprint's worth meant holding Ctrl while scrolling a list
two rows high.

## What Changes

- The select becomes a checklist: every change as a row with a checkbox,
  whether it is archived or under way, in a list that shows about ten
  rows and scrolls.
- Changes under way come first, then the archived ones, newest first:
  a sprint is usually the last few weeks.
- A search box narrows the rows by every word typed. What was ticked
  stays ticked.
- **Archived in the range, and under way** ticks, at once, every change
  archived between the report's dates (from the date `openspec archive`
  puts in front of the folder) and every change still under way. **All**
  and **None** do what they say. A count says how many of how many are
  chosen.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `standalone-app` - how a sprint report's changes are chosen.

## Impact

- New `packages/webui/src/components/ChangeChecklist.tsx` and its test.
- `packages/webui/src/standalone-entry.tsx`, `packages/webui/src/shell-ui.ts`.
- `packages/server/e2e/sprint-report.spec.ts` chooses through the
  checklist.
- A changeset: webui and the server, which serves its bundle.

## Explicitly out of scope

- **The editor's sprint report command.** It picks changes through a
  Quick Pick, which already scrolls and filters.
