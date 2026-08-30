## Why

`ChangesList.tsx`/`ArchiveList.tsx` both do a plain, unwindowed `.map()`
over their full (filtered) array into real `<li>` DOM nodes — no
virtualization exists anywhere in this codebase (confirmed: no
virtualization library is installed, directly or transitively). Neither
list sits in a height-bounded scroll container either, so the search
`<input>` above them scrolls out of view as the list grows. This was
raised in the improvement backlog as "for repos with 200+ changes, the
UI slows down — needs virtualized lists"; the VS Code extension side is
unaffected (native `vscode.TreeView` already virtualizes/recycles rows
internally), so this is a standalone-webui-only gap. This repository's
own real archive already has ~80 changes — high enough to exceed a
moderate threshold and validate this change against real, live data
rather than only synthetic fixtures.

## What Changes

- Add `@tanstack/react-virtual` as a new `packages/webui` dependency — a
  headless windowing hook, actively maintained, imposes no markup.
- New shared hook `packages/webui/src/components/use-virtual-list.ts`:
  below a size threshold (`VIRTUALIZE_THRESHOLD = 50`), renders every
  item exactly as today; above it, renders only the visible window of
  DOM rows via `useVirtualizer`. Both branches always sit inside a new,
  height-bounded scroll container (`max-height` + `overflow-y: auto`) —
  applied uniformly regardless of item count, both fixing the
  "search box scrolls out of view" gap and giving windowing a bounded
  viewport to window against.
- `ChangesList.tsx`/`ArchiveList.tsx` both adopt the hook. No change to
  either component's existing per-item markup or `data-testid`s.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui`: `ChangesList`/`ArchiveList` now render inside a
  height-bounded scroll container and switch to windowed DOM rendering
  above a size threshold, with identical visible content below it.

## Impact

- `packages/webui/package.json` (new dependency).
- `packages/webui/src/components/use-virtual-list.ts` (new),
  `use-virtual-list.test.ts` (new).
- `packages/webui/src/components/ChangesList.tsx`,
  `packages/webui/src/components/ArchiveList.tsx`, and their test files.
- `packages/webui/src/shell-ui.ts` (fixed row-height CSS rule matching
  the estimated item height).
- No change to `packages/core`, `packages/server`, the command/event
  protocol, or the VS Code extension.
