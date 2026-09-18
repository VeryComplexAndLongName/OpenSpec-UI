## Context

The standalone Changes and Archive lists filter through
`packages/webui/src/components/change-filter.ts`, whose `filterChanges`
matches a change's name or its status label, case-insensitively; a
`shared-ui` requirement says both lists use that one predicate.

The editor has seven tree views. `archive-tree.ts`, `specs-tree.ts` and
`change-graph-tree.ts` build their rows from a reading and hand them to VS
Code. None of them can be narrowed: VS Code's own type-to-find highlights a
row, it does not hide the rest, and a tree view cannot host a text box.

The Change Graph nests by `follows`: roots are connected changes that
follow nothing, children hang under the change they follow, and what no
root reaches is listed under a notice. An archived change is drawn like any
other, with "archived" in its description.

## Goals / Non-Goals

**Goals:**

- Narrowing a view is one press and one line of typing, in the editor.
- One predicate, in core, for every list and tree in both hosts.
- A finished branch of the graph is out of the way by default and one
  press from coming back.
- A view that is narrowed or folded says so, with numbers.

**Non-Goals:**

- **A text box inside a tree view.** VS Code has none to give.
- **Filtering the Changes view.** It carries the actions; DW asked for the
  three that do not, and adding a filter where a person archives and runs
  is a way to act on a row you cannot see.
- **A roadmap number on a change.** DW's CHANGE-049 problem is answered
  here by search; carrying their number in `.openspec.yaml` so a view can
  find `CHANGE-049` directly is a separate change, and they have not asked
  for it yet.

## Decisions

### The filter is a command, a stored word and a message

Each of the three views gains `openspec-ui.filter<View>` in its title bar:
it opens an input box seeded with the current filter, stores what comes
back on the provider, and refreshes. The view's `message` then reads
`Filtered by "<text>" - showing N of M`, and `openspec-ui.clearFilter<View>`
appears beside it while a filter is set, through a `when` clause on a
context key.

That is the shape VS Code gives: a title command plus a message. A webview
would give a real text box and lose the tree — its keyboard, its
decorations, its context menus — for a search field.

**Rejected: filtering as you type through a quick pick.** A quick pick
takes the focus and closes on the first choice, so narrowing a view to read
it would end the moment the reader looked at a row.

### One predicate, in core

`packages/core/src/view-filter.ts` exports `matchesFilter(query, fields)`:
every whitespace-separated word of the query must appear, case-insensitively,
in at least one of the fields. `change-filter.ts` in the shell keeps its
name and its signature and calls it, so the lists behave exactly as before
and the rule stops being webui's private business.

Words rather than a substring: DW types part of a name and part of a state
in the same breath, and "blocked pipeline" should find the blocked pipeline
change rather than nothing.

**Rejected: fuzzy matching.** A view that answers "which of these is
CHANGE-049" must not also answer "something like it".

### A branch folds when every change in it has landed

`view-filter.ts` also exports `landedBranches(graph)`: for each root, the
set of changes reachable through `follows`, and whether every one of them
is archived. The graph view draws those roots only when the fold is off,
and otherwise ends with a row reading `N landed relations hidden` that
switches it off when pressed.

The fold is on by default, because the view exists to show what is being
decided now and DW's two examples are finished clusters that were in the
way. The count is always drawn, so nothing goes quiet.

**Rejected: hiding an archived change wherever it appears.** A live change
that follows an archived one has to show what it follows, or the row loses
its reason to exist. Only a whole branch folds.

### The fold and the filter do not fight

A filter is applied to what the fold leaves. Where a filter matches
something inside a folded branch, the branch is unfolded for that reading
and the notice says so: a reader who types a name expects to be shown the
change of that name, whatever state it is in.

## Risks / Trade-offs

- **A default that hides.** The count is on screen whenever anything is
  folded, and one press brings it back; the alternative is DW scrolling
  past finished clusters for ever.
- **A filter that outlives the reading.** It is stored per view and per
  session, not written to disk, and the message keeps saying so.
- **Three views, three commands.** They share one provider-side mixin and
  one predicate, so the third costs a menu entry.
- **The graph's ids.** A folded root changes nothing about the ids of the
  rows that remain: `reveal` still finds a change by the path it is reached
  through.

## Protocol

No command or event of the run protocol changes. The extension gains six
commands of its own — filter and clear, for three views — and one context
key per view.
