## Why

DW, on 2026-09-18, describing how they actually work: their roadmap numbers
changes — CHANGE-049, CHANGE-050 — while OpenSpec names them by what they
do, so every dependency they read sends them hunting for the title that
matches the number. Their words: "then I'm figuring out which change title
matches up with CHANGE-049". They asked for search boxes beside Archive,
Specs and the Change Graph, and, separately, for an option to hide the
parts of the Change Graph where every change has landed — naming
`operator-dashboard-decision-configuration-actions` and
`pending-decision-vs-declared-applications`, two clusters that are finished
and still drawn.

Both are the same complaint from two directions: the views show everything
there has ever been, and the reader has to do the narrowing.

Today only the standalone Changes and Archive lists can be narrowed — they
share one filter (`change-filter.ts`) behind a search box. The editor's
Archive, Specs and Change Graph trees have no filter at all, and the graph
draws every relation that was ever declared, archived or not. This
repository's own archive is 269 changes; DW's is large enough that they
described the graph as something they scroll past.

## What Changes

- **The editor's Archive, Specs and Change Graph views can be filtered.**
  Each gains a Filter command in its title bar, which asks for text and
  narrows the view to what matches; the view then says what it is filtered
  by and how much it is hiding, and a Clear command puts it back.
- **The rule is one rule.** The predicate the standalone lists already use
  moves into core, and every view — both hosts — narrows by the same
  case-insensitive match on a name and the words beside it.
- **A landed branch of the Change Graph folds.** Where a root and
  everything that follows it are archived, the branch is folded away by
  default and a row says how many it is hiding; one press shows them
  again.
- **Nothing disappears silently.** A filtered view and a folded branch both
  state what they are not showing, with the count, so a reader can tell an
  empty view from an emptied one.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-ui`: the one search predicate serves every list and tree, in both
  hosts.
- `vscode-extension`: the Archive, Specs and Change Graph views are
  filtered, and the graph folds what has landed.

## Impact

- **`packages/core`**: a new `src/view-filter.ts` with the shared
  predicate and the rule for a branch whose every change is archived, with
  its test.
- **`packages/webui`**: `components/change-filter.ts` delegates to core
  rather than carrying its own copy.
- **`packages/extension`**: the three tree providers take a filter; new
  Filter and Clear commands and their menu entries; the Change Graph's fold
  and its notice row.
- **Unchanged**: what a relation means, what the graph draws when nothing
  is filtered or folded, and every reading these views make.
