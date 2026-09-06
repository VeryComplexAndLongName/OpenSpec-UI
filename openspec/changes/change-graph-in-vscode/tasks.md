Blocked by `change-graph-in-core`: this change adds no parsing of its
own, and starting it before the reader is exported would mean writing one
that then has to be deleted.

## 1. The view

- [ ] 1.1 A sixth view in the `openspec-ui` container, beside Changes,
  Archive, Specs, Processes and Templates.
- [ ] 1.2 Roots are changes that follow nothing; children nest under the
  change they follow. Archived changes are marked as such — most of the
  graph is archived, and a reader must be able to tell at a glance what
  is still open.
- [ ] 1.3 A change with more than one parent appears under each. The
  relation is a DAG and this is a rendering of it; assigning one parent
  arbitrarily would drop the edge that explains half of why the change
  exists.
- [ ] 1.4 A cycle must not make the subgraph vanish. The terminal
  renderer had exactly this defect — with a cycle nothing is a root, so
  nothing printed and the output claimed no relation existed. Whatever
  core reports as unreachable is shown, labelled.
- [ ] 1.5 Read-only. The single action is "reveal in Changes/Archive", so
  this stays a reference and every mutation keeps one home.

## 2. Waiting on something

- [ ] 2.1 A change stating `blocked_by` on a change that is still active
  is marked as waiting on it.
- [ ] 2.2 Once the blocker is archived the mark goes; nothing needs
  editing, because archiving is what lands a change.
- [ ] 2.3 This is the question the graph is being asked first — what can
  be started now — so it must read at a glance, not on hover.

## 3. From a change to its reasons

- [ ] 3.1 A command on a change in Changes and Archive: show what it
  follows, walking back. The motivating question is "why is this number
  here", and it is asked while looking at the change, not at the graph.
- [ ] 3.2 Register it in `view/item/context` for both
  `openspec-ui.activeChange` and `openspec-ui.archivedChange`, matching
  how `showChangeTimeline` is already offered on both.
- [ ] 3.3 A change that follows nothing says so rather than opening an
  empty view.

## 4. Verification

- [ ] 4.1 `openspec change validate --strict change-graph-in-vscode`.
- [ ] 4.2 Unit tests over the tree items, on fixtures rather than this
  repository's own graph — the archive grows with every change, and a
  test reading it would fail for reasons unrelated to the rendering. The
  existing `processes-tree.test.ts` mocks `vscode` the same way.
- [ ] 4.3 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 4.4 Version bump via `npx changeset` for `openspec-ui-vscode`.
- [ ] 4.5 **Human-only**: reload the window, open the new view, and
  confirm the seven-change chain reads as the argument it records; that a
  change waiting on another is visibly waiting; and that asking a change
  what it follows lands on the same answer the terminal gives.
