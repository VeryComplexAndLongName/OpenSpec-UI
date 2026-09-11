Whether changes can run side by side is decided and answerable, and only
readable as a list. A list says what state one change is in; it does not
show that four changes are queued behind one nobody is running.

## 1. Where each change goes

- [x] 1.1 `change-layout.ts` in core: a pure function from
  `ChangeReadinessReport` to columns of nodes. In core beside the report
  it is derived from, not in the view — the CLI and the shell then place
  changes identically, and a second implementation in the browser would
  be free to drift invisibly.
- [x] 1.2 A change's column is its depth in the `blocked_by` order: zero
  where nothing blocks it, otherwise one past the deepest change it is
  blocked by.
- [x] 1.3 Within a column, ordered by change name. Not by state: sorting
  running changes first would move a node whenever a run started, and a
  node that moves reads as the plan having changed.
- [x] 1.4 A cycle is returned as a named list rather than placed. A
  cycle has no depth, and a drawing that quietly put it somewhere would
  be a wrong answer that looks like a right one.
- [x] 1.5 Edges are the declared blockers only. Collisions are carried
  on the node they affect, never as a relation (ADR 0025).

## 2. Getting the report to the shell

- [ ] 2.1 A server endpoint returning `readChangeReadiness` for the
  workspace, in the shape core already returns.
- [ ] 2.2 The extension answers the same request over its bridge, so
  both hosts read one report.
- [ ] 2.3 A webui client, browser-safe: it asks, it does not derive.
  `packages/server/src/static.test.ts` is the gate.

## 3. The tab

- [ ] 3.1 A **Pipeline** tab in `ALL_TABS`, and its panel.
- [ ] 3.2 Not loaded until first opened, and re-read only while active.
  Reading the report walks the changes directory and shells out to git,
  which is not work to do behind a tab nobody is looking at.
- [ ] 3.3 Nodes as real controls in a CSS grid — a `<button>` in a grid
  cell is already focusable and already has an accessible name, which a
  canvas or an SVG-only drawing would each need given by hand.
- [ ] 3.4 An SVG overlay for the edges, positioned from measured node
  geometry, recomputed on resize. Marked `aria-hidden`: what an edge
  draws is already stated in words on the node it points from.
- [ ] 3.5 Each node states its change name as a control that opens the
  change, and its state.
- [ ] 3.6 A running node names where it is running and, where the lease
  recorded one, the git author — called a git author, never a user
  (`a-lease-says-who`). A run whose lease recorded none claims nothing
  about who is running it.
- [ ] 3.7 A blocked node names what it waits on; a ready node names what
  it can start alongside, and for each change it cannot join, that
  change and the reason.
- [ ] 3.8 A cycle is stated above the picture rather than drawn.
- [ ] 3.9 When it last read, shown. The report is a moment, not a
  subscription, and must not be presented as more current than it is.
- [ ] 3.10 Scrolls horizontally in its own container. The page body
  never scrolls sideways — the same rule the shell's tables already
  follow.

## 4. Appearance

- [ ] 4.1 Styled in `shell-ui.ts`'s layer, from the existing tokens
  only. No colour literal outside `:root` — the guard in
  `shell-ui.test.ts` enforces it.
- [ ] 4.2 State is not carried by colour alone. A reader who cannot
  distinguish two hues must still be able to tell a running change from
  a blocked one.
- [ ] 4.3 Readable at 720px, where the tab's own media block applies.

## 5. Tests

- [x] 5.1 Core: a chain of blockers lands in successive columns; changes
  with no relation land side by side.
- [x] 5.2 Core: within a column, name order, and stable across two calls
  where only run state differs.
- [x] 5.3 Core: a cycle is returned as a cycle and placed nowhere.
- [x] 5.4 Core: collisions never appear as edges.
- [ ] 5.5 Server and extension: the endpoint and the bridge message
  return the report.
- [ ] 5.6 webui: a running node names the git author; one without an
  author claims nothing.
- [ ] 5.7 webui: a ready node names what it cannot join and why, and no
  edge exists between them.
- [ ] 5.8 webui: not read while the tab is inactive.
- [ ] 5.9 Browser suite: the tab passes axe at WCAG AA, and the
  screenshot under `docs/images/standalone/` is regenerated.

## 6. Verification

- [ ] 6.1 This change validates strictly. `check(validate-change)`
- [ ] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 6.3 The whole browser suite, not a selected spec.
- [ ] 6.4 A pending changeset exists. `check(changeset-present)`
- [ ] 6.5 **Delegated to `claude-cli`**: with two changes actually
  running in their own working directories, open the tab and check that
  each names the right author and the right state, and that stopping one
  is reflected on the next read. Evidence: the leases, and the tab
  before and after. Unit tests drive the view with a written report;
  only real runs show that the report a live workspace produces is the
  one the picture draws.
