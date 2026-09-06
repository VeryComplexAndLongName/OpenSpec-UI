The edges being recorded here already exist as prose. Transcribing them
is cheap; getting one wrong is not, because "this change corrects that
one" reads as authority whether or not it is true. Every edge in section
3 must be traceable to a sentence already written in the change that
claims it, quoted in the task. An edge that cannot be sourced that way
does not go in.

## 1. The two keys

- [x] 1.1 `follows: [<change-id>, ...]` — this change exists because that
  one left something: a named successor, an inherited failure, a
  measurement that had to come first. Optional, plural, ordered by
  nothing.
- [x] 1.2 `supersedes: [<change-id>, ...]` — this change corrects a
  decision that one made. Distinct from `follows`: `git-fixture-test-cost`
  chose 15000 ms from an isolated run and
  `every-varying-check-has-a-budget` replaced that number, which is not
  the same relation as inheriting its unfinished work.
- [x] 1.3 Document both in `openspec/README.md`, beside the existing
  runbook, including that they are optional and that an absent edge is
  not a defect. State the measured facts the design rests on: unknown
  keys pass `openspec change validate --strict` and are ignored by it, so
  this repository's own check is the only thing that reads them.
- [x] 1.4 Do not add `blocked_by`. Recorded here so the omission is a
  decision rather than an oversight: no instance exists, and the relation
  this repository actually has is causal, not a scheduling constraint.

## 2. The check

- [x] 2.1 `scripts/check-change-graph.mjs`, on the pattern of
  `scripts/check-english.mjs` and `scripts/check-test-budgets.mjs`: read
  every `openspec/changes/*/.openspec.yaml` and every
  `openspec/changes/archive/*/.openspec.yaml`, and resolve each stated
  id.
- [x] 2.2 Resolution must strip the archive's date prefix: an active
  change is `openspec/changes/<id>`, the same change archived is
  `openspec/changes/archive/<YYYY-MM-DD>-<id>`. An edge naming `<id>`
  resolves to either. Archiving must never break an edge — that is the
  case the value depends on, since most edges point at archived work.
- [x] 2.3 Fail on an id that resolves to neither, naming the change and
  the id.
- [x] 2.4 Fail on a cycle, naming the changes in it.
- [x] 2.5 Wire into the root `lint` script alongside `lint:english` and
  `lint:test-budgets`.
- [x] 2.6 `scripts/check-change-graph.test.mjs`: an edge to an active
  change passes; an edge to an archived change passes, date prefix and
  all; an edge to nothing fails and names both; a two-change cycle fails;
  a change with no edges passes.
- [x] 2.7 Confirm the check bites: add an edge to a change id that does
  not exist, see `npm run lint` fail on it by name, remove it. The
  walkers here read git-tracked files, so stage the fixture first.

  Verified 2026-09-06. The first attempt did not bite, and the reason is
  worth keeping: several `.openspec.yaml` files end without a trailing
  newline, so appending `follows:` produced `created: 2026-09-04follows:`
  on one line — silently ignored by this check and by `openspec` alike.
  The parser now reports a relation key that does not start its own line,
  and with a newline first the gate failed as intended, naming the file
  and the id.

## 3. Backfill the one chain whose edges are already written

Only edges established from an existing sentence, quoted in the task that
records them.

**Do not use the archive's date prefix as evidence of order.** Checked
2026-09-06, it is misleading in at least two places in this very chain:

- `core-test-worker-contention` is archived 2026-09-03 and
  `load-sensitive-test-timeouts` 2026-09-02, and the direction is what
  the dates suggest — the former says "`load-sensitive-test-timeouts`
  fixed a different thing well" and "Reverting anything
  `load-sensitive-test-timeouts` did".
- But `load-sensitive-test-timeouts`, archived 2026-09-02, opens by
  citing `git-fixture-test-cost`, archived 2026-09-05: "`git-fixture-test-cost`
  took the full local `npm run test` from eight…", and later
  "`git-fixture-test-cost` owns those". A change archived first can
  depend on one archived days later, because the date records when it
  closed, not when it started.

The first draft of this section had one of these edges backwards for
exactly that reason. That is the argument for the change, and it is also
why every task below establishes direction from a sentence rather than
from a listing.

- [x] 3.1 For each pair in the chain, find the sentence in which one
  change names the other, quote it in the task, and derive the direction
  from what the sentence says — not from which directory sorts first.
- [x] 3.2 `core-test-worker-contention` follows
  `load-sensitive-test-timeouts` — established above.
- [x] 3.3 `load-sensitive-test-timeouts` follows `git-fixture-test-cost`
  — established above.
- [x] 3.4 Establish where `task-checklist-timeout-ceiling` sits: it names
  `load-sensitive-test-timeouts`, and the direction needs the sentence,
  not the date.
  `task-checklist-timeout-ceiling` follows `load-sensitive-test-timeouts`
  — its proposal quotes the comment it is correcting, which ends "See
  load-sensitive-test-timeouts", and says the ceiling that comment
  describes "was never applied".
- [x] 3.5 `suite-survives-a-loaded-machine` follows
  `git-fixture-test-cost` — source: its proposal, "That last one is the
  proof — under the same co-load, the two files carrying its explicit
  measured ceilings passed while these six did not". Note that
  `git-fixture-test-cost` also names `suite-survives-a-loaded-machine`,
  which is a back-reference added when #228 rescoped its task 6.3 — a
  mention in both directions is not a cycle, and the check in section 2
  must not read it as one.
  Recorded as three parents, from the same sentence: "The fix is already
  established in this repository, three times over:
  `load-sensitive-test-timeouts`, `task-checklist-timeout-ceiling`, and
  `git-fixture-test-cost`'s own task 4.1." The rendering shows it under
  each, which is what makes the DAG visible.
- [x] 3.6 `every-varying-check-has-a-budget` follows
  `suite-survives-a-loaded-machine` and supersedes `git-fixture-test-cost`
  — sources: its proposal's opening, and its own section 2 record,
  "`change-timeline.test.ts` and `sprint-report.test.ts` carry 15000 ms
  chosen from isolated runs".
- [x] 3.7 `load-variance-not-per-file-cost` follows
  `every-varying-check-has-a-budget` — source: that change's task 4.3,
  "Successor created: `load-variance-not-per-file-cost`".
- [x] 3.8 This change follows nothing. It came from a question, not from
  a predecessor's residue, and recording an edge to make the graph look
  fuller would be the first wrong edge.
- [x] 3.9 Correction, found by task 5.5 rather than by any check:
  `load-variance-not-per-file-cost` also follows
  `core-test-worker-contention`, and the edge was missing. It says so
  twice — "extending the precedent `core-test-worker-contention` set
  there rather than inventing one" in its task 6.3, and
  "`core-test-worker-contention` had already run and rejected that
  configuration for this package" in its record of 6.1. Both are the
  relation this key exists for, and neither was transcribed.

  Two things this establishes, both worth more than the edge.

  The check cannot catch a **missing** edge. It verifies that a stated
  relation resolves; nothing tells it an edge should exist. That
  limitation is stated in this change's own proposal — "this makes a
  named successor checkable; it does not make anyone name one" — and this
  is the first time it has bitten. `human-only-inbox` proposes the
  narrower check that would have caught the specific case of a successor
  named in prose; this one was not a successor, so even that would have
  missed it.

  And a human verification item caught what four automated checks could
  not. 5.5 asked for a specific end of a specific chain, and the answer
  came back different. That is the argument for writing such items
  concretely enough to fail.

## 4. Rendering

- [x] 4.1 A `change-graph` command in `@openspec-ui/cli`, beside
  `release-manifest`: print the relation as a tree, roots first, each
  child indented under the change it follows, archived changes marked as
  such.
  Placed in `scripts/change-graph.mjs` rather than `@openspec-ui/cli`,
  which is a deviation from what this change proposed and is recorded
  rather than done quietly. The CLI is compiled and published while
  `scripts/` runs before any build and carries no dependencies, so the
  command there would have needed a second copy of the metadata parser.
  One reader, two entry points: `npm run graph:changes` and
  `npm run lint:change-graph`. Task 5.4's changeset is not needed as a
  result — nothing published changed.
- [x] 4.2 A change with more than one parent appears under each, rather
  than being assigned to one arbitrarily. The relation is a DAG; the tree
  is a rendering of it, and a rendering that silently drops edges is
  worse than the flat list it replaces.
- [x] 4.3 `--change <id>` to print one change's ancestry, which is the
  question that motivated this: from a decision back to its reason.
- [x] 4.4 Unit tests over the rendering, with fixtures rather than the
  repository's own graph, so the tests do not fail when the archive
  grows.

## 5. Verification

  Ten tests over fixtures, not over this repository's own graph, which
  grows with every change. One of them found a real defect: with a cycle
  no node is a root, so nothing rendered and the output claimed no
  relation existed — the whole subgraph would have vanished. Unreachable
  nodes are now printed under a heading that says why.
- [x] 5.1 `openspec change validate --strict change-dependency-graph`.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [x] 5.3 Confirm every backfilled edge against its quoted source before
  ticking section 3 — re-read the sentence, do not trust this list.
- [x] 5.4 No changeset. This was written expecting the command to live in
  `@openspec-ui/cli`; it lives in `scripts/` instead (see 4.1), so nothing
  published changes. The line is corrected rather than ticked as written.
- [x] 5.5 **Human-only**: run `change-graph` and confirm the chain in the
  proposal renders as the seven changes it describes, in that order, and
  that `--change load-variance-not-per-file-cost` walks back to
  `core-test-worker-contention`.

  Confirmed 2026-09-06, and it did not pass on the first reading. The
  chain rendered as described, but the ancestry stopped short of
  `core-test-worker-contention`. The edges recorded were right and one
  was missing — see task 3.9. With it added the ancestry reaches it, and
  this item is met as written rather than reworded to match.
