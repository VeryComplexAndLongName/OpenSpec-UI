## 1. Dependency and shared hook

- [x] 1.1 `packages/webui/package.json`: add `@tanstack/react-virtual`
  (`npm install @tanstack/react-virtual --workspace packages/webui`).
- [x] 1.2 `packages/webui/src/components/use-virtual-list.ts` (new):
  `VIRTUALIZE_THRESHOLD = 50`; `useVirtualList(items, itemKey, options?)`
  returning `{containerRef, containerStyle, listStyle, rows}` — below
  threshold, `rows` is every item with no style; above it, `rows` comes
  from `useVirtualizer`'s `getVirtualItems()` with absolute-position/
  translateY styles. `containerStyle` always sets `maxHeight`/
  `overflowY: "auto"`.
- [x] 1.3 `use-virtual-list.test.ts` (new, via `renderHook`): below
  threshold returns every item, no style; above threshold (mocking
  `HTMLElement.prototype.clientHeight`/`offsetHeight`) returns
  measurably fewer rows than the full count, each with a real
  `style.transform`.

## 2. Wire into ChangesList/ArchiveList

- [x] 2.1 `ChangesList.tsx`: use `useVirtualList(visible, (c) => c.name,
  { itemHeight: 40 })`; wrap the existing `<ul>` in a
  `<div ref={containerRef} style={containerStyle}>`, apply `listStyle`
  to the `<ul>`, map over `rows` instead of `visible`. No change to
  per-item markup/`data-testid`s.
- [x] 2.2 `ArchiveList.tsx`: same wiring.
- [x] 2.3 `packages/webui/src/shell-ui.ts`: add a fixed-height CSS rule
  for list rows (40px) matching the hook's `itemHeight` estimate.
- [x] 2.4 `ChangesList.test.tsx`/`ArchiveList.test.tsx`: add one case
  each asserting the wrapping scroll container has a bounded
  `maxHeight` style; existing assertions unmodified.

## 3. Spec, versioning, verification

- [x] 3.1 `openspec/changes/virtualize-change-lists/specs/shared-ui/spec.md`:
  `ADDED Requirements` for the bounded scroll container and windowed
  rendering above the threshold.
- [x] 3.2 `npm run typecheck && npm run lint && npm run test`
  workspace-wide (after `git add`).
- [x] 3.3 Changeset: minor bump for `@openspec-ui/webui`.
- [x] 3.4 Manual smoke test: run the real standalone server against
  this repository's own ~80 archived changes (already above the 50
  threshold), open Overview, confirm via real-browser DOM inspection
  that the rendered `<li>` count in the Archive list is well below the
  full archived-change count, and that scrolling reveals correct
  further rows.
- [x] 3.5 `openspec change validate --strict virtualize-change-lists`
  passes.
