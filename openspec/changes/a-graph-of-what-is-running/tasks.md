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
- [x] 1.6 Coordinates, not only an ordering: each node's position and
  size and each edge's path, in abstract units. So that nothing in the
  view is measured — the alternative held the only state derived from a
  moment of rendering, needed a browser to check, and failed in a way
  that looks fine (a line pointing at nothing).
- [x] 1.7 An edge leaves its blocker's right edge and enters the blocked
  change's left edge, routed so one that skips a column does not run
  through a node in between.

## 2. Getting the report to the shell

- [x] 2.1 A server endpoint returning `readChangeReadiness` for the
  workspace, in the shape core already returns.
- [x] 2.2 ~~The extension answers the same request over its bridge, so
  both hosts read one report.~~ **Dropped, deliberately.** The VS Code
  embed shows one tab — `ALLOWED_TABS_VSCODE_EMBED` is `run-a-command`
  and nothing else — so a bridge operation for this tab would be an
  operation nothing can call. That is the thing
  `a-setting-reads-as-a-setting` was about. Should the embed ever show
  this tab, the operation is added then, against a caller.
- [x] 2.3 A webui client, browser-safe: it asks, it does not derive.
  `packages/server/src/static.test.ts` is the gate.

## 3. The tab

- [x] 3.1 A **Pipeline** tab in `ALL_TABS`, and its panel.
- [x] 3.2 Not loaded until first opened, and re-read only while active.
  Reading the report walks the changes directory and shells out to git,
  which is not work to do behind a tab nobody is looking at.
- [x] 3.3 Nodes as real controls, absolutely positioned at the
  coordinates core returned — a `<button>` is already focusable and
  already has an accessible name, which a canvas or an SVG-only drawing
  would each need given by hand.
- [x] 3.4 One SVG for the edges, its `viewBox` in the same units and its
  width the same multiple of `--u`, so it lines up without either half
  being asked where the other ended up. No measurement, no
  `ResizeObserver`. Marked `aria-hidden`: what an edge draws is already
  stated in words on the node it points from.
- [x] 3.5 `--u` is a `rem`, so the picture follows the reader's browser
  font setting. Not an `em`: a custom property holds a token, so `1em`
  would resolve against the font size of whatever element used it, and
  the shell fixes `body` at 14px so an `em` would not follow that
  setting at all.
- [x] 3.6 Each node states its change name as a control that opens the
  change, and its state.
- [x] 3.7 A running node names where it is running and, where the lease
  recorded one, the git author — called a git author, never a user
  (`a-lease-says-who`). A run whose lease recorded none claims nothing
  about who is running it.
- [x] 3.8 A blocked node names what it waits on; a ready node names what
  it can start alongside, and for each change it cannot join, that
  change and the reason.
- [x] 3.9 Text longer than a node card is truncated with the whole of it
  still on the element. The change name gets the room: it is what a
  reader scans for.
- [x] 3.10 A cycle is stated above the picture rather than drawn.
- [x] 3.11 When it last read, shown. The report is a moment, not a
  subscription, and must not be presented as more current than it is.
- [x] 3.12 Scrolls horizontally in its own container. The page body
  never scrolls sideways — the same rule the shell's tables already
  follow.

## 4. Appearance

- [x] 4.1 Styled in `shell-ui.ts`'s layer, from the existing tokens
  only. No colour literal outside `:root` — the guard in
  `shell-ui.test.ts` enforces it.
- [x] 4.2 State is not carried by colour alone. A reader who cannot
  distinguish two hues must still be able to tell a running change from
  a blocked one.
- [x] 4.3 Below 720px the picture becomes headed lanes — "can start
  now", then what follows — each node stating in words what it waits on,
  and no edges. Four columns of cards do not fit a phone in any
  implementation, and shrinking until it is technically present and
  practically unreadable is the worse answer. Nothing is lost: that
  wording is what the edges illustrate, and is already what the picture
  offers a screen reader.

## 5. Tests

- [x] 5.1 Core: a chain of blockers lands in successive columns; changes
  with no relation land side by side.
- [x] 5.2 Core: within a column, name order, and stable across two calls
  where only run state differs.
- [x] 5.3 Core: a cycle is returned as a cycle and placed nowhere.
- [x] 5.4 Core: collisions never appear as edges.
- [x] 5.5 Core: an edge that skips a column is routed clear of the nodes
  between, and the picture's own extent covers every node and path.
- [x] 5.6 Server: the endpoint returns the report, refuses a workspace
  outside the configured one, and refuses a body with no workspace.
- [x] 5.7 webui: a running node names the git author; one without an
  author claims nothing.
- [x] 5.8 webui: a ready node names what it cannot join and why, and no
  edge exists between them.
- [x] 5.9 webui: not read while the tab is inactive.
- [x] 5.10 Browser suite: the tab passes axe at WCAG AA, and the
  screenshot under `docs/images/standalone/` is regenerated. The two
  harness screenshots regenerated too — the tab strip they show now
  carries this tab, so leaving them would have documented a screen that
  had stopped existing.

## 6. Verification

- [x] 6.1 This change validates strictly. `check(validate-change)`
- [x] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Run of 2026-09-12: typecheck, lint and test all passed —
  cli 107, core 1092, extension 327, server 83, webui 389; 1998 in all.
- [x] 6.3 The whole browser suite, not a selected spec. 16 of 16 passed,
  including this tab's axe run at WCAG AA and its phone-width check.
- [x] 6.4 A pending changeset exists. `check(changeset-present)`
- [ ] 6.5 **Delegated to `claude-cli`**: with two changes actually
  running in their own working directories, open the tab and check that
  each names the right author and the right state, and that stopping one
  is reflected on the next read. Evidence: the leases, and the tab
  before and after. Unit tests drive the view with a written report;
  only real runs show that the report a live workspace produces is the
  one the picture draws.
