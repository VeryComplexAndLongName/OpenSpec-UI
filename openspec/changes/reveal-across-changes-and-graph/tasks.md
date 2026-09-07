`TreeView.reveal` needs `getParent` on the provider it reveals into, and
neither provider has one today. That is the whole of the mechanical work;
the judgement is in what happens when a change has no row, or several.

## 1. Make the views revealable

- [ ] 1.1 `ChangesTreeProvider.getParent` and `ArchiveTreeProvider.getParent`.
  Both trees nest change → artifact → task, so a change's parent is
  `undefined` and an artifact's is its change. Only what `reveal` is
  called with needs to resolve, and that is always a change.
- [ ] 1.2 `ChangeGraphTreeProvider.getParent`. A row's identity is the
  path it was reached through (`a>b>c`), so the parent is that path minus
  its last segment — the provider must return the same object identity
  VS Code was given, which means resolving the path rather than
  reconstructing a fresh item.
- [ ] 1.3 Register the graph with `createTreeView` rather than
  `registerTreeDataProvider`: `reveal` lives on the handle, and
  `registerTreeDataProvider` does not return one. Record why the earlier
  choice is being reversed — it was made because no command read the
  view's selection, and now one does.
- [ ] 1.4 Keep the graph read-only. Revealing is not acting: no mutating
  command gains a graph entry, and the reasoning in
  `change-graph-in-vscode` stands.

## 2. Reveal in Change Graph

- [ ] 2.1 `openspec-ui.revealInChangeGraph`, offered on a change in both
  the Changes and Archive trees, matching how `showChangeAncestry` is
  offered on both.
- [ ] 2.2 Find every row for the change, not the first. A row exists per
  distinct path. Re-measured 2026-09-07, correcting the count this task
  first stated: `load-variance-not-per-file-cost` has **four** rows, not
  two; `suite-survives-a-loaded-machine` and
  `every-varying-check-has-a-budget` have three each. Measure again when
  implementing rather than trusting any of these numbers — the point is
  that the case is real and larger than it looks, not the figure.
- [ ] 2.3 Reveal each, select the first, and report the count when it is
  more than one — "shown in 3 places" rather than silently landing on
  one.
- [ ] 2.4 When the change has no row, say that it states no relation and
  change nothing. Not an error, and not a silent no-op: the graph shows
  4 of 15 active changes today, so this is the common case, not the edge
  case.

## 3. Reveal in Changes

- [ ] 3.1 `openspec-ui.revealInChanges`, offered on a graph row.
- [ ] 3.2 Route by the row's own `archived` flag: an archived change is
  revealed in the Archive tree, an active one in Changes. Revealing into
  the wrong tree silently fails, which is worse than not offering it.
- [ ] 3.3 A row whose change has since been archived or deleted — the
  graph is read from disk on refresh, so this is possible mid-session —
  reports that rather than throwing.

## 4. Following the selection, opt-in

- [ ] 4.1 `openspec-ui.followSelectionInChangeGraph`, boolean, default
  `false`, with a description that says why it is off: the graph shows
  only changes that state a relation, so for most changes there is
  nothing to reveal.
- [ ] 4.2 When on, subscribe to the Changes and Archive views'
  `onDidChangeSelection` and reveal without stealing focus
  (`{ select: true, focus: false }`) — following a selection must not
  move the cursor out of the list the reader is browsing.
- [ ] 4.3 When on and the change has no row, do nothing quietly. The
  explicit command explains; the automatic one must not interrupt.
- [ ] 4.4 Unsubscribe when the setting is turned off, without requiring a
  reload.

## 5. Tests

- [ ] 5.1 `getParent` on each provider: a change resolves to `undefined`,
  an artifact to its change, a graph row to the row above it on its path.
- [ ] 5.2 A change with one row reveals it; a change with three rows
  reveals three and reports three; a change with none reports that it
  states no relation.
- [ ] 5.3 A graph row for an archived change reveals into Archive, an
  active one into Changes.
- [ ] 5.4 With the setting off, a selection change reveals nothing —
  asserted directly, since this is the default every user gets.

## 6. Verification

- [ ] 6.1 `openspec change validate --strict reveal-across-changes-and-graph`.
- [ ] 6.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 6.3 Version bump via `npx changeset`: two commands and a setting.
- [ ] 6.4 Document both commands and the setting in the extension README,
  beside the Change Graph entry this change builds on.
- [ ] 6.5 **Human-only**: with the setting off, use both commands on a
  change with several parents and on one with none; then turn the setting
  on and confirm browsing the list moves the graph without taking focus
  out of the list.
