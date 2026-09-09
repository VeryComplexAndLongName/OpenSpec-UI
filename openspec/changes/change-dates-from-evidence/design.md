# Design

## Decision: every date carries its source

```
interface DatedFact {
  date: string | null;      // ISO 8601
  source: "git-commit" | "git-blame" | "audit-log" | "folder-name" | "none";
}
```

Without it a chart cannot tell a measured date from an inferred one, and
they plot identically. "Created 9 September" read from a commit and
"created 9 September" read from a directory name are different claims,
and only one of them survives someone renaming a directory.

`source: "none"` with `date: null` is a fact too — a change nobody has
committed yet has no creation date, and a chart should be able to say so
rather than fall back to today.

## Decision: four dates, not two

| Date | Read from | Notes |
| --- | --- | --- |
| `proposed` | `git log --diff-filter=A --follow` on `proposal.md` | Survives the archive rename. Already implemented as `createdDate`. |
| `firstWorked` | earliest `git blame` author time across `tasks.md`, or the earliest audit entry for the change | The first is available for every committed change; the second only since 2026-09-02. |
| `lastWorked` | latest of the same two | |
| `archived` | the commit that added the change under `archive/`, without `--follow` | Falls back to the folder name prefix. |

`proposed` → `archived` is mostly waiting. `firstWorked` → `lastWorked`
is the span a chart about effort actually wants, and neither of the two
existing dates gives it.

## Decision: git first, the folder name last

The folder name is what `openspec archive` writes, so it is right
whenever that command did the archiving — and wrong or missing whenever
anything else did. It stays as the fallback, and when it is used the
source says so.

The same order applies to `.openspec.yaml`'s `created:` field, which
this repository writes but nothing reads. It is not promoted to a
source: a field a person fills in is the one that will be wrong, because
nothing checks it against the commit that actually added the file.

## Decision: one git call per change, not one per date

`git log --diff-filter=A --follow --format=%aI -- <path>` and the
archive-path variant are two calls; blame over `tasks.md` is a third and
is already made for the task list. Over 50+ archived changes that is the
difference between a page that loads and one that does not, so the dates
are read where the timeline is already read, not on their own.

## Rejected: filesystem timestamps

A fresh clone gives every file the same mtime. It would produce a chart
where every change was created on the day someone cloned the repository,
and it would look plausible.

## Rejected: a date field people must write

That is the convention this exists to remove. It also fails the case
that prompted it: a change created by someone who does not know the
convention.
