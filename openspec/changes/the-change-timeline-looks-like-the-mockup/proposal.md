## Why

ADR 0033 says the standalone shell looks like the approved mockup
(<https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L>), and names the order:
the frame, the summary and Harness Settings are done; both Timeline screens
come next. The owner looked at the Timeline on 2026-09-17, in the browser
and in VS Code: "Timeline does not match the mockup. Here every task sits
on a kind of chip, each holding its time and the rest; the mockup is
different altogether. What they share is the dots on the left joined by a
line. Nothing else has changed."

The mockup's "Timeline: one change" artboard answers questions today's
screen leaves to the reader:

- **When did work happen?** The mockup draws moments, not rows. Tasks ticked
  in one commit are one moment ("27 tasks ticked in one commit"), because
  git gives them one time. Today they are 27 rows with the same time.
- **How much, and how long?** A tile says "29 / 29" and "proposed to
  archived in 10 h 07 min". Today nothing says either.
- **Where did a date come from?** The Dates panel names each date's source,
  "from a git commit" or "from git blame on tasks.md". Core has read those
  sources since change-dates-from-evidence; no screen shows them.
- **Which change is this?** The page head carries the change's name.
  Today the name is a small heading inside the panel, and loading needs a
  second press after choosing.

## What Changes

- **The one-change screen is the mockup's.** A toolbar with "One change",
  "Compare changes" and "Sprint report", the change picker, and "Stale
  after N days". Choosing a change loads it; there is no Load button.
- **Tasks over time** lists the change's moments on a rail: when it was
  proposed, each moment tasks were ticked, grouped where they share one,
  and when it was archived. A group shows its first three tasks and "and N
  more".
- **A Tasks tile** gives done and total, and the span from proposal to
  archive, or to the last work on an active change.
- **A Dates panel** gives proposed, first worked, last worked and archived,
  each with its source. Where tasks share a moment, a note says why.
- **What the rail cannot place stays on the screen.** Open tasks, with
  stale ones marked, and done tasks with no readable date, are listed below
  the rail. The proposal, design and specs stay available below, closed.
- **The page head names the change** once one is shown, and choosing
  another puts the shown one away at once.
- **A task reads as its whole sentence.** Core's task checklist keeps the
  lines `tasks.md` wraps a task onto; the view shows the sentence on one
  line without its Markdown marks.
- **The editor's timeline panel draws the same view**, in one column when
  the panel is narrow, with the change's name as its heading.
- **Compare changes and the sprint report are not in this change.**
  Compare changes comes next as its own change, since it needs a faster
  read of dates.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `standalone-app`: what the Timeline tab's one-change screen shows and how
  a change is chosen; the stale threshold applies without loading again.
- `vscode-extension`: the per-change timeline webview shows the same view.

## Impact

- **`packages/webui`**: a new `src/timeline-moments.ts` with its test;
  `src/components/ChangeTimelineView.tsx` and its test; the Timeline tab in
  `src/standalone-entry.tsx`; the page head for the timeline; styles in
  `src/shell-ui.ts`; `src/timeline-entry.tsx`.
- **`packages/core`**: `TaskChecklistItem` gains an optional `continued`,
  read in `src/task-checklist.ts`, with its test.
- **`packages/server/e2e`**: `frame-screenshots.spec.ts` captures the screen
  in both themes from a fixture with a dated history.
- **Unchanged**: core's `ChangeTimeline` routes, Compare changes, the sprint
  report, and the editor's compare and sprint commands.
