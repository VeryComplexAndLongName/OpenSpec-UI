## Context

`workspace-leftovers.ts` (from `the-workspace-clears-what-it-left-behind`)
reads every directory under `openspec/changes/` that carries no document,
and clears the ones whose change is archived and whose every file is one
this product writes. `worktree-survey.ts` says of each working directory
whether it is `finishedWith`, from a merge base, a clean tree and no run
recorded. `change-standing.ts` reads refs, the archive on `main` and pull
requests, and is where "Merged in #N" and "Archived on main" come from -
but it reads the survey, so the survey cannot read it back.

`PipelineView.tsx` already receives `standings`, so it has every fact this
change needs to fold a card; what it does not have is a way to archive
one.

## Goals / Non-Goals

**Goals:**

- The sweep covers the two cases it was asked about and missed: an empty
  directory, and a shell under the worktree root.
- "Finished with" is true when the work is actually over, in a repository
  that squashes its pull requests.
- A removal that cannot happen says what is holding the directory.
- The Pipeline shows what is being worked on, with what has landed folded
  away and archivable in one press.

**Non-Goals:**

- **Removing a working directory without being asked.** Unchanged from the
  change that introduced the reading: a directory whose branch merged can
  still hold somebody's uncommitted work, and there is no undo.
- **Archiving without being asked.** The folded row offers a press; a
  change is never archived because it looked finished.
- **A general process killer.** The holder is named, never stopped.

## Decisions

### An empty directory is the product's own leaving

`onlyProductFiles` becomes true for a directory with no files at all.
Nothing in an empty directory can be somebody's work, and the second half
of the rule - that a change of that name is archived - still keeps a
person's fresh `mkdir` safe, because nothing of that name is in the
archive.

**Rejected: clearing any empty directory under `openspec/changes/`.**
That is the rule the original change rejected for a reason that has not
changed: an empty directory whose name is nowhere in the archive may be a
change somebody is about to write.

### The worktree root is swept for shells, and only for shells

`git worktree remove` on Windows leaves the directory behind where a
junction was inside it. Git stops listing it, so nothing surveys it, and
it is invisible to the product that made it.

The sweep reads the worktree root (ADR 0027's, where the working
directories live), lists what git calls a working directory, and reports
every other directory that holds **no files at all**, at any depth. A
directory holding a single file is reported and never cleared: a shell is
empty by definition, and anything else is somebody's.

**Rejected: removing by age.** A directory nobody touched for a week can
still be the one somebody comes back to; emptiness is a fact, age is a
guess.

### What "finished with" means, and where it is decided

The survey keeps its cheap signals - the branch gone from everywhere, or
its tip an ancestor of the default branch. A new reading in
`change-standing.ts`, which already has the pull requests and the archive
on `main`, adds the two that settle it in a squashing repository: the
change's pull request is merged, or `main` carries the change archived.

It is decided there rather than in the survey because the standings read
the survey, and the reverse would be a cycle. The leftovers route asks for
standings instead of the raw survey, which it can: it already reads the
workspace.

**Rejected: teaching the survey to run `gh`.** The survey's whole
discipline is that it runs two git calls and reads files (ADR 0026). A
process per directory to ask GitHub is the opposite of that.

### A refusal names who might hold the directory

On Windows, `EBUSY`/`EPERM` says nothing about who. The holder is read
best-effort from the process list, by looking for a command line that
mentions the directory - which is how the three servers were found: they
were started with the path as an argument.

Best-effort is stated, not implied: a process whose working directory is
inside but whose command line does not name it is not found, and the
refusal says so rather than claiming nobody holds it.

**Rejected: listing open handles.** That needs an external tool on
Windows and privileges this product does not ask for.

### The Pipeline folds what has landed

A card folds when its standing says the work is over: archived on `main`,
merged in a pull request, or gone from `main` after being there. The
folded cards become one row with their count, which opens them, in the way
the Change Graph folds a landed branch.

The row offers **Archive them**, which the host carries out one change at
a time through core's existing archive, reporting what could not be
archived rather than stopping at the first.

The filter is the shared predicate from `view-filter.ts`, over a change's
name and its standing word, so a word that finds a change in the editor's
views finds it here.

## Risks / Trade-offs

- **A fold hides what a reader was looking for.** Shown with its count and
  one press away, as the graph's is, and a filter that matches inside it
  opens it.
- **Archiving several changes at once is several mutations.** Each is the
  same archive a card already offers, run one after another, and each
  failure is named. Nothing is archived that the fold did not show.
- **The holder reading costs a process listing.** Only on a refusal, never
  on the sweep's normal path.
- **Standings cost a `gh` call.** Already cached per repository and
  best-effort; where it cannot run, the reading falls back to the survey's
  cheap signals, which is what it does today.
