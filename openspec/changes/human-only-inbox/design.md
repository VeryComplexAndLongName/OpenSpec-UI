# Design

## Context

Three things are proposed together because they share one cause: a fact
that is true in the repository, recorded in a file, and visible to nobody
until someone opens that file. An open human-only item, a successor
promised in prose, and a `MODIFIED` block that no longer matches its
specification are all written down and all unread.

The pieces to build them with already exist. `readTaskChecklist` in
`packages/core/src/task-checklist.ts` parses `tasks.md` into items
carrying `lineNumber`, `text`, `done`, and an optional `check`
declaration. `change-graph.ts` reads the stated `follows` /
`supersedes` / `blocked_by` relation across active and archived changes.
`openspec archive` already refuses a stale spec delta and names what it
found. Nothing here needs a new way to read `openspec/`.

## Decision: one parser, one more field

The human-only marking becomes a field on `TaskChecklistItem`, beside
`check`, populated by the same pass. Not a second reader over the same
file.

`check` is the precedent and the argument: it was added as an optional
field on the item rather than as a parallel parser, and everything that
reads tasks — the timeline, the chain runner, the tree — sees it without
being taught to. A second parser would drift from the first the first
time the checkbox syntax moved, and the two would disagree about what a
task even is.

## Decision: match the wording the repository actually uses

The marking is a bold lead beginning `Human-only`. Measured across every
active and archived change on 2026-09-06, the bolded leads mentioning a
person are:

| Lead | Count |
|---|---|
| `**Human-only, cannot be completed by an implementing agent**` | 22 |
| `**Human-only**` | 18 |
| `**Human-only, rechecked and confirmed 2026-09-02**` | 1 |
| `**Human-only, and the only real test**` | 1 |
| `**Human-only, and in the other repository**` | 1 |
| `**Human-only screenshot task**` | 1 |
| `**Human-observed live run completed 2026-09-02**` | 1 |

A prefix match on `Human-only` takes the first six — 44 of 45. The
seventh is a closed item reporting an observation that was made, not a
marking asking for one, and matching it would be wrong rather than
generous.

So: prefix, case-insensitive, on the bolded lead. Documented as exactly
that, per task 1.3, so a change that words it differently is a gap
someone can see rather than an item that quietly never appears. The
alternative — accepting anything containing "human" anywhere in the line
— would catch prose about human review inside ordinary tasks, and an
inbox that lists things nobody is waiting on is one people stop opening.

## Decision: the checks are tests in `packages/core`

Both new checks run as tests, the way the relation check does.

`openspec/README.md` states the reason for that choice and it applies
unchanged here: a test "runs from source with nothing built", so the
check cannot be silently skipped by a build that did not happen, and it
fails in the one job every pull request already runs. Adding a lint
script would put these two checks somewhere different from the check they
are most like, for no gain.

This also settles "at pull-request time rather than at archive time",
which is the whole point of the spec-delta check: the drift that caused
it twice in one day was not the author's doing — another change landed in
between — and finding it at the archive step means finding it after the
work is finished and reviewed.

## Decision: the inbox says when nothing is waiting

An empty tree is ambiguous between "nothing is waiting on you" and "this
never loaded". A notice row is not, and the Change Graph view already
does this with `ChangeGraphNoticeTreeItem`.

This matters more than it sounds. The queue is expected to be empty
often — as of 2026-09-06, after twelve changes were archived, exactly one
active change is waiting only on a person. A view that renders blank
whenever the good state holds teaches people it is broken.

## Decision: nothing in the inbox marks an item done

No command, no context-menu action, no checkbox. Selecting an item opens
the change it belongs to and nothing else.

The rule the inbox exists to serve is that a person reports a human-only
item after observing the thing it names. A control here would sit exactly
where someone is looking at a list of items they have not observed, and
this repository has already recorded two items ticked without
observation. The cost of not having the button is one navigation; the
cost of having it is the rule.

## Rejected: guessing which prose names a successor

The check looks for the wording used — `Successor created:` and the
change id in the same line — and says so in the failure. It does not
infer.

A matcher loose enough to catch every way someone might promise a
successor would accuse changes that promised nothing, and a false
accusation on a merge gate is worse than the silence being replaced:
silence is corrected by the next person who reads the file, a false
failure is corrected by disabling the check.

## Rejected: an inbox that spans archived changes

An archived change's open human-only item is a defect in the archive, not
a queue entry — nobody is waiting on it, because the change is closed.
Listing it would mix "do this" with "this was closed wrong", and only the
first is what the view is for.

Whether an archived change may carry an open item at all is a separate
question, and `checkpoint-storage-split` is the case to reason from: it
was archived on 2026-09-06 with its human-only item closed as
unperformable rather than performed, which is the honest form and the one
a check would have to learn before it could flag anything.

## What this does not decide

Whether the successor check should also read the archive's prose for
promises made before the relation existed. Task 2.4 asks for that run to
be *recorded*, not acted on: three known cases have since been given
edges, so a clean result says the check would not have caught them then
— which is worth knowing before it is trusted, and is a different change
if the answer is that it should.
