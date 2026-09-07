## Why

The Change Graph answers "what does this follow"; the Changes and Archive
trees are where a change is acted on. Moving between the two means
finding the same change by eye in a different list, which is exactly the
work a tool should do.

The obvious version of this — sync the selection, so highlighting a
change in one view highlights it in the other — does not survive contact
with the data.

**Most changes are not in the graph.** Measured 2026-09-06: **4 of 15**
active changes appear in it, and **8 of 134** archived ones. The graph
shows a change only when it states a relation or something states one to
it, which is the right rule for a graph and the wrong basis for a
follow-the-selection behaviour: browsing the Changes list would leave the
graph blank eleven times out of fifteen, and a reader would reasonably
conclude the view is broken.

**A change can occupy several rows.** `suite-survives-a-loaded-machine`
has three parents and therefore three rows;
`load-variance-not-per-file-cost` has two. "Reveal the change" has no
single answer, and picking one row silently hides the others — precisely
where the multiplicity is the information.

So: reveal on request, in both directions, saying plainly when there is
nothing to reveal. Following the selection is available for those who
want it, and off by default.

## What Changes

- **Reveal in Change Graph**, on a change in Changes or Archive. Where
  the change occupies several rows, all of them are revealed rather than
  one chosen. Where it states no relation, the command says so instead of
  revealing nothing.
- **Reveal in Changes**, on a graph row — unambiguous in this direction,
  since a row is exactly one change, and its `archived` flag decides
  which of the two trees to open.
- `openspec-ui.followSelectionInChangeGraph`, default `false`: when on,
  selecting a change reveals it in the graph automatically.

## Capabilities

### Modified Capabilities

- `vscode-extension`: a change can be located in the other view on
  request, and the ambiguity of a change with several parents is
  surfaced rather than resolved arbitrarily.

## Impact

- `packages/extension/src/tree/` (both providers gain `getParent`, the
  graph view moves to `createTreeView`), `commands.ts`, and the manifest.
  Changeset needed: the extension gains two commands and a setting.

## Explicitly out of scope

- **Following the selection by default.** The measurement above is the
  reason. A behaviour that does nothing in the majority of cases teaches
  people to distrust it; opt-in keeps it available without that cost.
- **Making the graph show every change.** Adding relation-less changes so
  the reveal always lands would fill the view with a flat list of
  everything, which is the Changes tree with extra indentation. The
  `--all` flag on the CLI already exists for anyone who wants that view.
- **Selecting several rows at once.** `TreeView.reveal` takes one
  element; where a change has several rows this expands each and selects
  the first, and the command says how many there were rather than
  implying the first is the only one.
