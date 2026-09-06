## Why

Changes in this repository already depend on each other, and the
dependencies are already written down — as English sentences inside task
lists, where nothing can read them.

Seven changes from the last three weeks are one argument:
`git-fixture-test-cost`, `load-sensitive-test-timeouts`,
`task-checklist-timeout-ceiling`, `core-test-worker-contention`,
`suite-survives-a-loaded-machine`, `every-varying-check-has-a-budget`,
`load-variance-not-per-file-cost`.

The links between them exist today as prose: "Carried from
`suite-survives-a-loaded-machine`", "Tracked as
`core-test-worker-contention`", "Successor created:
`load-variance-not-per-file-cost`". So the graph is already being
maintained. It is just being maintained in a form that cannot be
queried, cannot be validated, and disappears from view the moment a
change is archived.

They are listed above without an order on purpose. The first draft of
this proposal put them in one, and got it wrong at the front, by reading
the archive's date prefix as the order they happened in. It is not:
`load-sensitive-test-timeouts`, archived 2026-09-02, opens by citing
`git-fixture-test-cost`, archived 2026-09-05 — a change archived first
can depend on one archived days later, because the date records when it
closed. Recovering the real order took reading four proposals. That is
the cost this change removes, and the mistake is left recorded here
rather than quietly corrected, because it is the clearest evidence that
the flat listing misleads.

Two things follow from that.

**A reader cannot get from a decision to its reason.** `maxForks: 4` in
`packages/core/vitest.workspace.ts` is the end of a seven-change
argument. Reconstructing it means opening seven archived directories in
the right order, which nobody will do.

**A named successor is not a real one.** Three times in a single day, a
change named what it had not resolved, archived, and the residue lost its
owner — each time surfacing as a surprise in the next change.
`every-varying-check-has-a-budget` added a task against exactly this
("anything still failing gets an owner before this change is archived — a
task in this change, or a successor change created and named here. A note
in a task list is not an owner"). That task worked, and it worked because
a person read it. Nothing checks it.

## What Changes

- Two optional keys in a change's `.openspec.yaml`: `follows` and
  `supersedes`, each a list of change ids. `follows` means "this change
  exists because that one left something"; `supersedes` means "this
  change corrects a decision that one made".
- A `lint` check that every id named resolves to a real change — active
  or archived — and that the graph has no cycles. A named successor that
  does not exist becomes a failing build rather than a sentence.
- A `change-graph` command in `@openspec-ui/cli` that prints the relation
  as a tree, so the flat directory listing keeps its simplicity and the
  hierarchy becomes a view.
- The one chain above, backfilled, because it is the chain that
  demonstrates the format and the only one whose edges are already
  established in prose.

## Load-bearing facts

Measured 2026-09-06 against the installed `openspec` CLI, because the
design depends on what it tolerates:

- **Unknown keys pass `openspec change validate --strict`.** A probe
  change carrying `follows`, `supersedes` and a deliberate
  `nonsense_key: 42` validated clean. The keys can live in the existing
  file; no parallel metadata file is needed.
- **They are also ignored.** The same probe named
  `follows: a-change-that-does-not-exist` and still validated. Nothing
  upstream will check these values, so the check in this change is the
  only thing that will.
- **Malformed YAML is caught, not silently dropped.** Breaking the file
  while `skip_specs: true` was set produced an explicit error naming the
  file. A syntax error in a hand-edited graph will not pass unnoticed.
- **Archiving preserves the file byte for byte** — every archive in this
  repository moves `.openspec.yaml` with 100% similarity — so edges
  survive into history, which is where most of their value is.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `quality-gates`: a stated relation between changes is verified rather
  than trusted, so a successor that was named but never created fails the
  build instead of being discovered later.

## Impact

- `openspec/changes/*/.openspec.yaml` for the backfilled chain, one new
  script under `scripts/`, one command in `packages/cli`, and
  `openspec/README.md`. No runtime behaviour changes; a changeset is
  needed for the `cli` command, on the precedent `release-manifest` set.

## Explicitly out of scope

- **A directory hierarchy.** `openspec/changes/<parent>/<child>/` was the
  first idea and it is the wrong one:
  `every-varying-check-has-a-budget` follows
  `suite-survives-a-loaded-machine`, corrects `git-fixture-test-cost`,
  and touches a file owned by `core-test-worker-contention` — three
  parents. The relation is a DAG, not a tree, and a tree forces the loss
  of every edge but one. The flat archive with a date prefix is also what
  keeps `openspec archive` and delta application simple.
- **A blocking relation.** `blocked_by` is not added, because no instance
  of it exists: all twelve active changes are independent, each waiting
  on its own human verification. The relation here is causal and
  historical, not a scheduling constraint. Add the field when a real case
  appears, not before.
- **Backfilling the whole archive.** 131 changes, most of whose edges are
  not stated anywhere and would have to be guessed. A wrong edge is worse
  than a missing one: "this change corrects that one" reads as authority.
  Only edges already written in prose are transcribed.
- **Enforcing that residue gets named.** This makes a named successor
  checkable; it does not make anyone name one. That still depends on the
  task in the change and the person reading it.
