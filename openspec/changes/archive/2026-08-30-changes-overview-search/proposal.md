## Why

`packages/webui/src/components/ChangesList.tsx` and `ArchiveList.tsx`
already exist, are unit-tested, and match ADR-0001's "one shared component
set for both delivery targets" intent — `ArchiveList` even already
implements a client-side search box. Neither is actually used: the
standalone app's real "OpenSpec view summary" tab
(`packages/webui/src/standalone-entry.tsx:886-913`) hand-rolls a static,
non-interactive `<table>` for active changes fed by `POST /api/overview`,
duplicating display logic `ArchiveList` already has for the equivalent
archived case — and the Overview tab has **no archived-changes list at
all** today (archived change names only appear as bare `<option>` entries
in four unrelated dropdown pickers: copy-tasks-as-template, Timeline ×2,
sprint-report). Users have no way to find a specific change once either
list is long, and no way to browse archived changes at all outside those
dropdowns, even though half the component work for exactly this already
shipped and sits unused.

## What Changes

- Wire the existing `ChangesList`/`ArchiveList` components into the
  standalone app's Overview tab: replace the hand-rolled active-changes
  `<table>` with `ChangesList`, and add a new "Archive" section using
  `ArchiveList` (there is none today), instead of adding a second,
  parallel search implementation next to dead code.
- Add a search box to `ChangesList` (today it has none), and extract the
  filter predicate both components use into one shared, pure,
  independently-tested function that matches a query against a change's
  `name` **or** its human-readable status label — so "search by status"
  (part of the original ask) works without a new field.
- Core: a new function to compute `completedTasks`/`totalTasks`/
  `lastModified` for an *archived* change (reusing the existing
  `readTaskChecklist` parsing rather than a third re-implementation of
  checkbox counting), since `/api/overview` currently discards everything
  but the archived change's `name`.
- Server: `/api/overview` gains an additive `archivedChangeSummaries`
  field carrying that richer per-archived-change data. The existing
  `archivedChanges: string[]` field is left unchanged — it is already
  consumed by four other pickers in `standalone-entry.tsx` (copy-tasks-
  as-template, Timeline, compare-changes, sprint-report) that only need
  plain names; changing its shape would have been a breaking change to
  all four for no benefit to this feature.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `standalone-app`: the "OpenSpec view summary" tab's Changes section
  becomes a searchable list (by name or status) instead of a static
  table; a new Archive section is added, also searchable, showing
  archived changes with real task progress and a last-modified date
  (previously not shown in this tab at all).
- `shared-ui`: `ChangesList` gains the same client-side search `ArchiveList`
  already had; both now share one filter implementation.

## Impact

- `packages/core/src/task-checklist.ts` (new `getArchivedChangeSummary`,
  exported via the existing `export *` in `index.ts`; intentionally NOT
  added to `browser.ts`, matching that file's existing Node-fs-only
  exclusion rule).
- `packages/server/src/rest.ts` (`OverviewResponse` gains
  `archivedChangeSummaries`; `handleOverviewRequest` populates it).
- `packages/webui/src/standalone-entry.tsx` (Overview tab rendering),
  `packages/webui/src/components/ChangesList.tsx`,
  `packages/webui/src/components/ArchiveList.tsx`, new
  `packages/webui/src/components/change-filter.ts`.
- No change to the command/event protocol (`Command`/`Event` in
  `packages/core/src/protocol.ts`) — `/api/overview` is a separate,
  ad-hoc REST endpoint, not part of that protocol.
- No change to the VS Code extension (separate surface: native
  `TreeView`s, no shared component involved).
