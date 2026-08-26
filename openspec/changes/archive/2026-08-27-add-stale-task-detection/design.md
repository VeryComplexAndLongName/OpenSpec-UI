## Context

The user asked for stale-pending-task detection with a configurable
threshold, explicitly leaving the default value to this agent's
judgment. `2026-08-26-add-change-timeline-data-layer` already computes
a `finalLineNumber -> ISO date` blame map per `tasks.md`; the only gap
is that `getChangeTimeline` discards it for still-pending tasks.

## Goals / Non-Goals

**Goals:**
- Reuse the existing blame computation entirely — no new git calls.
- A configurable threshold, not a hardcoded one, in both delivery
  targets.
- `isTaskStale`/`findStaleTasks` are pure and host-neutral, so both
  webui and the extension use the identical logic rather than each
  reimplementing "how old is too old."

**Non-Goals:**
- Not adding staleness to the multi-change comparison view — it only
  plots `createdDate`/done-task `date`/`archivedDate` today, never
  pending tasks at all, so there is no existing point to flag. Adding
  pending-task points there is a bigger, separate UI change.
- Not a proactive notification/popup for stale tasks. Consistent with
  this project's established local-first, no-noise stance (see the
  archive-time Changesets reminder's own design.md for the same
  reasoning) — the signal is visible in the timeline view when the user
  looks, not pushed at them.
- Not adding a tree-view badge in the Changes/Archive views — that
  would need a background scan (recomputing blame) independent of the
  timeline view's already-paid-for fetch, a real performance question
  deferred rather than answered here.

## Decisions

### 14-day default threshold

No existing convention in this codebase to anchor to, so: two weeks is
long enough that normal day-to-day pending work (a task genuinely
being actively worked on, just not finished yet) is not flagged, and
short enough that a truly forgotten task is still caught while the
context to act on it is still fresh. Configurable in both hosts, so
this default is not load-bearing.

### `lastTouchedDate` is a new field, not a repurposed `date`

`ChangeTimelineTask.date` was deliberately restricted to checked tasks
only in the prior change, specifically because a blame date for an
unchecked line reads as a misleading "completion" date. Reusing it here
for staleness would undo that fix. A second field keeps both meanings
intact: `date` = "completed on," `lastTouchedDate` = "line last edited
on," used for different purposes.

### `change-timeline-client.ts` now imports real types instead of a hand-duplicated copy

Adding `lastTouchedDate` to core's `ChangeTimelineTask` required also
adding it to webui's hand-duplicated copy in `change-timeline-client.ts`
— a maintenance burden that already caused exactly this kind of drift
once. Since `browser.ts` already exists as the browser-safe export
surface, and adding type-only exports there costs nothing at runtime,
this change re-points `change-timeline-client.ts` at the real
`@openspec-ui/core/browser` types instead, closing the drift risk for
good rather than patching this one instance of it.

## Verification note

Following the lesson from `2026-08-26-fix-timeline-webview-csp-inline-script`
(a prior smoke test that loaded the bundle in an unrestricted page
missed a real CSP bug), this change's manual verification constructed
the HTML exactly as `TimelineWebviewPanel.getHtml()` does — same CSP,
same nonce'd inline-script shape, both `__OPENSPEC_UI_TIMELINE__` and
`__OPENSPEC_UI_STALE_THRESHOLD_DAYS__` assignments — before trusting
that the real webview would render stale/fresh tasks correctly.
