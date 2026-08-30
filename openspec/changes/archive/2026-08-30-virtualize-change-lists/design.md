## Context

`ChangesList.tsx:32-51`/`ArchiveList.tsx:35-47` both render every item
of their (filtered) array as a real `<li>`, with no windowing. Neither
sits inside a height-bounded container — `packages/webui/src/shell-ui.ts`
has no `max-height`/`overflow` rule for `.openspec-changes-list`/
`.openspec-archive-list`, only for an unrelated feature
(`.openspec-ai-panel-events`, the AI-panel run event log). No
virtualization library exists in the dependency tree today, direct or
transitive (verified against `package.json` and `package-lock.json`
across the whole monorepo). This repository's own archive currently has
~80 changes (`openspec/changes/archive`) — under the "200+" figure the
backlog cites, but useful for real-data validation once a threshold
below ~80 is chosen.

`vitest.config.ts` for `packages/webui` uses `environment: "happy-dom"`
— like `jsdom`, it does not run a real layout engine, so
`clientHeight`/`offsetHeight`/`getBoundingClientRect` report zero by
default. `@tanstack/react-virtual` needs a non-zero scroll-container
size to compute which rows are "visible" — the standard, documented way
to test it under such environments is to mock those properties on
`HTMLElement.prototype` for the duration of the test.

## Goals / Non-Goals

**Goals:**
- Rendering a very long Changes/Archive list keeps the number of live
  DOM nodes bounded, independent of total item count.
- Below the threshold, behavior and DOM output are unchanged from today
  (aside from now sitting inside a bounded scroll container) — no risk
  to any existing test, which all use small (2-6 item) fixtures.
- The search box no longer scrolls out of view as a list grows.

**Non-Goals:**
- No caching of `/api/overview` responses and no background loading —
  separate, later backlog items (see the broader improvement backlog item
  "Large repository optimization", which lists virtualization, caching,
  and background loading as three separate needs).
- No virtualization for `SpecsTree`/`SpecsSearch` — structurally exposed
  to the same problem, but neither is currently wired into
  `standalone-entry.tsx` (dormant code); virtualizing dead code now
  would be speculative work for a UI surface that doesn't exist yet.
  Noted here so it isn't forgotten if/when they are ever wired in.
- No change to the VS Code extension — native `vscode.TreeView` already
  virtualizes/recycles rows regardless of item count.

## Decisions

### `@tanstack/react-virtual`, not `react-window` or a hand-rolled implementation

User's explicit choice. `@tanstack/react-virtual` is a headless hook
(`useVirtualizer`) that computes which indices are visible and their
offsets, without imposing any markup — a natural fit for keeping
`ChangesList`/`ArchiveList`'s existing per-item JSX untouched. Rejected
a hand-rolled windowing implementation: reinventing scroll-offset
math, resize handling, and overscan tuning is real, error-prone work for
a problem a well-maintained library already solves; the "quick win"
framing argues for adopting, not reinventing.

### A hook (`useVirtualList`), not a wrapper component

Rejected a generic `<VirtualizedList items={...} renderItem={...} />`
component: `ChangesList`'s row markup (name/state-label/progress/
lastModified button) and `ArchiveList`'s (name/progress/lastModified,
no state label) differ enough that forcing them through one
`renderItem` prop would either lose type-safety or need a lowest-
common-denominator shape. A hook that returns `{containerRef,
containerStyle, listStyle, rows}` lets each component keep its own JSX
and `data-testid`s exactly as today, changing only how the list of rows
to map over is produced.

### Scroll container is always bounded, not just above the threshold

User's explicit choice, confirmed over "only bound it once
virtualization activates." Applying `max-height`/`overflow-y: auto`
unconditionally fixes the existing "search input scrolls out of view"
gap for every list size, and means a list crossing the threshold as it
grows doesn't suddenly change layout shape — the container always looks
and behaves the same way; only the DOM-node count inside it changes.

### `VIRTUALIZE_THRESHOLD = 50`

Below 50, `useVirtualizer`'s own output isn't used — items render
exactly as today (real DOM nodes for every item), so no existing test
is at risk (all current fixtures are 2-6 items). Above 50, only the
visible window of rows is mounted. 50 is chosen specifically because
this repository's own real archive (~80 changes) already exceeds it —
letting the manual smoke test validate against real, live data instead
of requiring a synthetic fixture. There is no meaningful downside to
crossing into the windowed path somewhat earlier than "200+" might
suggest: the non-virtualized visual output is identical either way, and
windowing 50+ rows is cheap and safe.

### Testing the windowed path requires mocking layout properties

`use-virtual-list.test.ts` mocks `HTMLElement.prototype.clientHeight`/
`offsetHeight` (via `Object.defineProperty`) for its above-threshold
case, since happy-dom reports 0 for both by default and
`@tanstack/react-virtual` needs a non-zero viewport to compute a visible
range. This is the standard approach for testing this library under a
non-layout-capable DOM — documented in the library's own test suite and
widely used in projects testing it under jsdom/happy-dom.

## Risks / Trade-offs

- **[Risk]** A new runtime dependency (`@tanstack/react-virtual`) adds
  bundle size and a new supply-chain surface. → **Mitigation**: it's a
  small, headless, widely-used, actively maintained package; the
  alternative (hand-rolled windowing) carries higher correctness risk
  for comparable or greater code size.
- **[Risk]** `itemHeight` is a fixed estimate (40px); if a row's real
  rendered height ever diverges (e.g. very long change names wrapping to
  two lines), the windowed path could show gaps or overlap. →
  **Mitigation**: a matching fixed-height CSS rule is added for list
  rows so estimate and real layout agree; accepted as a reasonable
  trade-off for a first version, revisit with `measureElement`-based
  dynamic sizing only if a real case of divergence is reported.

## Migration Plan

- No data migration; additive (new dependency, new hook, wraps existing
  markup in a container).
- Version bump (minor) for `@openspec-ui/webui`.
- Rollback: revert the dependency addition and the three touched files
  together; no persisted state is introduced.
