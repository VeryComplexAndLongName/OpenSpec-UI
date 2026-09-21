## The assumption that did not hold

The design agreed in conversation was "Changes shows one change - the one
this working directory is for". A fresh worktree was then cut, and it held
three active changes: this one, and two of somebody else's that were active
on `main` when the branch was taken.

That is not a defect to fix. A worktree is a checkout of a branch, the
branch comes from `main`, and `main` carries every active change as
committed files. Filtering the view down to one would hide changes that are
really in the tree, really editable, and really about to be archived under
this directory's feet.

So the view keeps every change and answers the question the owner actually
asked - "what do I do with these two?" - by saying, on each row, whose it
is. One row is this directory's, and it is drawn first and named in the
view's description; that is the "one change" part, and it survives.

## Where ownership comes from

Three facts, all already read by `surveyWorktrees`:

1. `directory.belongsTo` - the change a directory is the worktree of: its
   branch bears the change's name and that change is active in the main
   directory (ADR 0022, as `change-card.ts` already uses it).
2. `directory.runs[].person` - the enrolled person a signed status record
   names, and `signature`, which says whether the record checks out. Since
   #625 an agent that is not running a stage reports the same record, so a
   directory with an agent in it is visible even between runs.
3. `survey.thisAuthor` and the roster label of this process - which of
   those people is the reader.

A change is then one of four things, and `changeOwnership` in `core` says
which:

- **`here`** - this directory's own change. Everything is offered.
- **`elsewhere`** - another directory is its worktree. Named with the
  directory's label, and with the person where a verified record gives one.
- **`unverified`** - another directory is its worktree, and a record
  there does not check out. Drawn as `elsewhere`, and the description says
  the signature did not check out rather than naming anybody. A record
  that fails its signature is evidence of nothing, and naming the person
  it claims to be would be worse than naming nobody.
- **`nobody`** - no directory has taken it up. Ordinary, and actionable:
  this is the state a change is in between being proposed and being
  started, and anybody may pick it up.

## Why the icon goes grey and the colour stays

The row's icon already carries the standing's colour, and
`the-icon-carries-the-colour` settled that the colour belongs on the icon
and not the label. Ownership cannot have the same channel.

It takes the icon's **shape**: an `elsewhere` row is drawn `lock` in
`disabledForeground`, and a `here` or `nobody` row keeps the state icon and
its colour. Losing the standing's colour on somebody else's row costs
nothing true: this checkout's copy of their change is a snapshot from when
the branch was cut, so its green tick is about the past. The word is still
in the description and the tooltip, as it is for every other row, so a
screen reader is told exactly what an eye is told.

## Read-only, by the scheme rather than by a flag

Another directory's `proposal.md` opens through a
`TextDocumentContentProvider` on a scheme of this extension's own. A
document on such a scheme cannot be saved - there is nothing to save it
to - so read-only is a property of where the text came from rather than a
flag somebody can forget to set. The alternative, opening the real file and
setting an editor option, is one command away from being written to, and
that write would land in another agent's index.

The URI carries the directory's path and the file's name, and the title
reads `<change> (<directory>, read-only)`.

## Refusing, not merely hiding

The mutating commands are hidden on an `elsewhere` row by `contextValue`,
and each of them also asks `changeOwnership` and refuses by name when the
answer is not this directory's. A `when` clause governs a menu; the command
palette, a keybinding and another extension all reach the command without
one. The refusal names the directory and says to work there, because the
useful thing to know is not "no" but "over there".

## Alternatives considered

**Filter the view to this directory's change.** Rejected above: it hides
files that are in the tree.

**A second tree, "changes elsewhere".** Two trees for one list, with the
same rows moving between them as branches are cut and merged. The
description already carries where, and one list stays one list.

**Read ownership from branch names alone.** No signature, no person, and
wrong the moment a branch is renamed or a directory is reused. The signed
records exist precisely so that this question has an answer that can be
checked.
