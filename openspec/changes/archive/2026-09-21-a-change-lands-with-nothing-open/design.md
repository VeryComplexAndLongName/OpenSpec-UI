## The three endings, and why not two

Two endings - done and waived - would be simpler, and would make us
write down something untrue. Item 4.3 asked whether a ceiling per unit
reads more clearly than one number. Nobody could answer that on
2026-09-20 at 11:20, because the thing had not shipped. Ticking it as
done would have recorded a judgement that had not been made; waiving it
would have recorded a decision not to judge, which was not the decision
either.

So there is a third: **deferred**. It is still a closed item - the change
is free - and what it says is "this moved to the inbox". The judgement
still happens; it just stops holding a change open while it waits.

The three are read from the item's own line, in the same shape the
existing markers use:

```
- [x] 4.3 **Human-only.** Whether a ceiling per unit reads as clearer
  than one number.
  Done by Claude on 2026-09-20 at the owner's request: ran ... and saw ...

- [x] 2.4 **Human-only.** Whether the colour reads on a dark theme.
  **Waived by the owner:** the theme is not shipped yet, and the check
  would be about a screen nobody sees.

- [x] 4.3 **Human-only.** Whether a ceiling per unit reads as clearer
  than one number.
  **Deferred:** judged once it ships; in the Human-Only Inbox.
```

`**Waived` and `**Deferred` are read as bold leads on the item or its
continued lines, the way `**Human-only.**` and `**Delegated to <id>**`
already are. The item keeps travelling with its change into the archive,
as a record of what was decided; where the question itself must outlive
the change, the next section says where it goes.

## Where a deferred question lives, and the measurement that decided it

The first design read deferred items out of the archive: the item stays
a line in `tasks.md`, and `tasks.md` travels into
`openspec/changes/archive/<date>-<id>/`. One source of truth, no new
file.

It was measured before it was written, because `human-only-inbox.ts`
already carried a warning against exactly this - "reading 178 of them to
confirm that would cost the caller a page load". On 2026-09-20 this
repository has **285 archived changes, 1.76 MB of task lists**. Reading
them all takes **309 ms**; a `stat` pass over them alone, to read only
what changed, still takes **74 ms**. On every collection, to find one
deferred item.

So the question **moves** instead, to `openspec/deferred.md`: one file,
one read, each line naming the change that raised it. The change's own
item is closed as deferred, which is a record of what happened rather
than an open question, so nothing can drift - the two say different
things on purpose.

The list is appended to rather than rewritten: people read and edit it
too, and a rewrite loses whatever they wrote around it.

## The gate asks about one change

`runValidateAll` validates every active change, which is right for
structure: a broken proposal anywhere should be seen. It is wrong for
open items: a pull request for change A must not fail because change B,
already merged and waiting on the owner, has something open.

So the open-item rule takes the change the pull request is for. This
repository names a branch after its change, so CI passes
`${{ github.head_ref }}` and the gate applies the rule to that change
alone. Where the branch names no active change - an archive pull
request, an article, a branch named anything else - the rule is skipped
rather than guessed at.

## A tick without a record

For an item marked human-only or delegated, "done" is a claim about
something that happened outside the repository. The only thing that
makes it checkable later is what was written under it: what was run,
what was seen.

So the gate reports a human-only or delegated item closed as done with
nothing written under it. Not every item - an ordinary `2.1 the function
returns X` is evidenced by the code and the test in the same pull
request. Only the ones whose evidence exists nowhere else.

This is the one rule here that a determined agent can satisfy by writing
a sentence it did not earn. It is worth having anyway: a sentence is a
claim somebody can check and disagree with later, and an empty tick is
not.

## The two alarms

Both are read from facts the standings already carry:

- **Nothing open, and no pull request.** The work exists only in a
  working directory. It is the one state where the directory sweep and
  the change state must not be read separately: the sweep will not
  remove such a directory (its branch has no upstream), and this says
  why it is still there.
- **Nothing open, and a pull request closed without merging.** Work
  declared done and then rejected. Silence here reads as "finished".

They are words on the change's standing, beside the ones that already
exist, and they are loud because they are rare.

## What this does not change

The word "Merged in #619" stays true and stays where it is. The reason
it read as "finished" was that a change could be merged with something
open; once it cannot be, the word says what it always meant.
