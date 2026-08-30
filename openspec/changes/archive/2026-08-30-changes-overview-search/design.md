## Context

`ChangesList`/`ArchiveList` (`packages/webui/src/components/`) were built
against a `ChangeSummary` shape (`name`/`state`/`completedTasks`/
`totalTasks`/`lastModified?`) and are exported from `webui`'s barrel, but
no host ever instantiates them — the standalone app's Overview tab reads
`POST /api/overview` into its own local `OverviewChange`/`OpenSpecOverview`
types and renders a plain `<table>` for active changes only. There is no
archived-changes list anywhere in the Overview tab today — archived names
surface only as bare `<option>` entries in four unrelated dropdown
pickers (copy-tasks-as-template, Timeline ×2, sprint-report). `ArchiveList`
already carries a `query`/`useMemo` search box (`ArchiveList.tsx:14-22`)
that has never run in a real app.

`/api/overview`'s `archivedChanges: string[]` (`rest.ts:100-108`) is
populated from `discoverOpenSpecWorkspace`'s `WorkbenchChange[]`, which
itself has no `completedTasks`/`totalTasks`/`lastModified` fields — only
`name`/`path`/`state`/`archived`/`artifacts`. That same field is read in
four other places in `standalone-entry.tsx` (copy-tasks-as-template
picker, Timeline tab, compare-changes picker, sprint-report picker) purely
as a list of names for `<option>` elements.

`task-checklist.ts`'s `readTaskChecklist` (from the `tasks-tree-expand`
change) already parses a change's `tasks.md` into `{lineNumber, text,
done}[]` via `discoverOpenSpecWorkspace` + the `TASK_CHECKBOX_LINE_RE`
regex, resolving the tasks-artifact path the same allowlisted way
`readArchivedChangeTasksTemplate` does — the precedent this change follows
for computing archived-change progress, instead of adding a third
checkbox-counting implementation alongside `change-state.ts`'s
`TASK_CHECKBOX_RE`-based counter and this one.

## Goals / Non-Goals

**Goals:**
- Active/archived change lists in the standalone Overview tab become the
  real, shared `webui` components — not a second parallel implementation.
- Both lists filter by the same predicate (name or status label), so
  behavior is identical regardless of which list the user is searching.
- Adding archived-change progress data is strictly additive to
  `OverviewResponse` — no existing consumer of `archivedChanges: string[]`
  changes.

**Non-Goals:**
- No tag/category field or filtering. Nothing in the change data model
  (`WorkbenchChange`, `OpenSpecChangeListItem`, `ChangeSummary`) has a
  tag/category concept today; inventing one is a separate, larger change,
  explicitly deferred.
- No `onSelect`/click-to-navigate wiring. The current hand-rolled table
  has no row interaction at all; this change preserves that (a
  navigation feature would be a separate, unrequested addition).
- No VS Code extension changes. The extension's Changes/Archive views are
  native `vscode.TreeView`s with no shared-component involvement; adding
  a filter box there is a different UI surface and a separate change.
- No new git-derived timestamp logic. Archived `lastModified` is
  approximated from filesystem mtime (see Risks) rather than building a
  general-purpose "last commit touching this path" utility that nothing
  else in this codebase currently has either.

## Decisions

### Archived-change progress is computed in `core`, not `server`

`getArchivedChangeSummary(workspaceRoot, changeName)` lives in
`packages/core/src/task-checklist.ts` and is called once per archived
change from `rest.ts`. Rejected computing it directly in `rest.ts` (read
`tasks.md`, count checkboxes, `fs.stat` inline): that would duplicate
parsing logic `task-checklist.ts` already owns and violates the repo
invariant that all business logic — including "what counts as progress
for a change" — lives only in `core`; `server` stays a thin adapter that
just calls it and shapes the JSON response.

### New `archivedChangeSummaries` field, `archivedChanges: string[]` unchanged

Rejected changing `archivedChanges` from `string[]` to an object array:
grepping `standalone-entry.tsx` found four other call sites
(copy-tasks-as-template, Timeline, compare-changes, sprint-report
pickers) that only ever do `.map((name) => ...)` over it for `<option>`
elements — changing its shape would force updating all four for a
feature that doesn't touch them. An additive `archivedChangeSummaries:
Array<{name, completedTasks, totalTasks, lastModified}>` field is used
only by the new `ArchiveList` wiring, leaving every existing consumer of
`archivedChanges` untouched.

### The CLI's free-form `status` string is validated, not blindly cast

`OpenSpecChangeListItem.status` (`openspec.ts:59`) is `string`, sourced
from the real `openspec` CLI (`openspec list --json`), not the
`ChangeState` union `ChangesList`/`ArchiveList` render. The real fixture
(`openspec-fixtures/list.json`) shows `"in-progress"` matching the union
exactly today, but nothing guarantees the CLI's wording is contractually
stable. A new, side-effect-free `packages/webui/src/overview-mapping.ts`
(kept separate from `standalone-entry.tsx`, which renders to
`document.getElementById("root")` at import time and so cannot be
imported from a unit test) exports `toChangeState(status: string):
ChangeState`, which checks membership in the known union and falls back
to `"in-progress"` with a `console.warn` for anything else, rather than
`as ChangeState`-casting a value that could silently render as
`undefined`/blank state styling. This is normalization of a value
`execution-core`'s CLI already derived, not new status-*calculation*
logic in the UI layer — `shared-ui`'s existing "Change status comes from
derived state, not UI logic" requirement is about not re-deriving status
from scratch in the view layer, which this does not do.

### Filter predicate extracted to a shared, pure function

`packages/webui/src/components/change-filter.ts` exports `filterChanges`
(and moves the existing `STATE_LABEL` map out of `ChangesList.tsx` so both
components import the same one). Rejected keeping two separate `.filter()`
predicates (extending `ArchiveList`'s inline one, writing a second one for
`ChangesList`): the two would drift the moment one gained a case someone
forgot to also add to the other — this repository's own `design.md`
precedents (e.g. `tasks-tree-expand`'s shared `getChangeChildren`) already
established "one shared implementation, not two copies" as the preferred
fix whenever duplication is discovered mid-change, not just when the
duplication is added.

## Risks / Trade-offs

- **[Risk]** Archived `lastModified` is filesystem mtime of `tasks.md`
  (or the change directory if `tasks.md` doesn't exist), while active
  changes' `lastModified` comes from whatever the `openspec` CLI itself
  uses internally (unknown, possibly git-based) — the two numbers are not
  guaranteed to mean exactly the same thing. → **Mitigation**: accepted;
  documented here and in the spec delta as "best-effort," consistent with
  how `readTaskChecklist`/`change-state.ts` already treat filesystem state
  as the available source of truth in this codebase. Revisit only if a
  real discrepancy is reported.
- **[Risk]** `toChangeState`'s fallback (`"in-progress"` + `console.warn`)
  could mask a genuine, silent CLI contract change if nobody reads browser
  console warnings. → **Mitigation**: accepted for a first version;
  the fallback is exercised by an explicit unit test for an unrecognized
  value so the behavior itself is at least verified, not just hoped for.
- **[Risk]** Reading `tasks.md` per archived change adds one extra file
  read (via `getArchivedChangeSummary`) for every archived change on every
  Overview load, on top of the existing `discoverOpenSpecWorkspace` scan.
  → **Mitigation**: accepted; this repository's own change history (per
  `tasks-tree-expand`'s design.md) already accepted the same class of
  cost for tree-view expansion with no reported problem, and Overview is
  an explicit user-triggered "Load summary" action, not a background poll.

## Migration Plan

- No data migration. Purely additive: one new core function, one new
  additive REST response field, replacement of dead-code-adjacent UI with
  the components already shipped for this exact purpose.
- Version bump (minor) for `@openspec-ui/core`, `@openspec-ui/server`,
  and `@openspec-ui/webui` (new exported function, new response field, new
  rendering behavior respectively) — none is a breaking change to an
  existing external contract.
- Rollback: revert the package changes together; no persisted state is
  introduced.
