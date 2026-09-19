## Context

`discoverOpenSpecWorkspace` lists a change per directory under
`openspec/changes/`, archived ones under `archive/`. Nothing looks inside
before deciding it is a change: `directoryNames` in
`packages/core/src/workbench.ts` filters on `isDirectory()` alone. A
directory holding one file the product wrote is therefore a change with no
schema, no tasks and no state, listed beside real work in every host.

`openspec archive` moves the documents it knows about. A `harness.json`
written by the per-change harness settings panel is not one of them, so the
directory survives the move with that file in it. This is how the two
leftovers of 2026-09-18 came to be, and both held `{}`.

Working directories are already surveyed: `surveyWorktrees` in
`worktree-survey.ts` lists them with their labels, branches and the runs
recorded against them, and `change-standing.ts` reads refs, merge bases and
pull request state for a change. Nothing joins the two into "this directory
has nothing left to do".

## Goals / Non-Goals

**Goals:**

- A directory that is not a change is never listed as one.
- What the product itself left behind is cleared by the product.
- What might be somebody's work in progress is shown, never removed.
- One reading in core, the same words in both hosts.

**Non-Goals:**

- **Changing what `openspec archive` moves.** The CLI is not this
  repository's, and a leftover it does not know about is exactly what this
  reads.
- **Removing a working directory by itself.** See the decision below.
- **A general cleaner.** Nothing outside `openspec/changes/` and the
  surveyed working directories is read, and no file is removed from a
  directory that holds a document.

## Decisions

### A leftover is a directory with no documents, and its evidence travels

`workspace-leftovers.ts` returns, for each directory under
`openspec/changes/` (and under `archive/`), whether it carries any of
`proposal.md`, `design.md`, `tasks.md` or a `specs/` directory. One that
carries none is a `WorkspaceLeftover`, with:

- the names of the files it does hold, so a person can see what would go;
- whether a change of the same name is in the archive;
- whether every file it holds is one the product writes (`harness.json`,
  `status.json`, `.openspec.yaml`).

`discoverOpenSpecWorkspace` leaves it out of `changes`, which is what stops
"No tasks" appearing beside real work.

**Rejected: treating a directory with only `.openspec.yaml` as a
leftover.** That file is how a change declares its schema, and a change
being started by hand can hold it alone.

### Only the product's own leavings are cleared, and only where the archive
holds the change

The sweep removes a leftover when both are true: a change of that name is
in the archive, and every file in the directory is one the product writes.
Everything else is reported.

That is the narrowest rule that covers what actually happened, and it
refuses the case that would hurt: a person who made
`openspec/changes/my-idea/` and has not written the proposal yet keeps the
directory, because nothing of that name is archived.

**Rejected: removing any directory with no documents, at startup**, which
is the shape the owner's request suggests. It cannot tell an archived
change's leavings from a change somebody is about to write, and the cost of
being wrong is somebody's start.

**Rejected: an age threshold instead of the archive check.** A change
started before lunch and written after it would be removed by any threshold
short enough to be useful.

### A stale working directory is reported, never removed

`surveyWorktrees` already lists working directories; this adds, for each,
whether its branch is merged into the default branch or gone from the
remote, whether its tree is clean, and whether any run is recorded against
it. All three make it "finished with".

Removal stays a press, and the press does what the sessions here learned to
do by hand: delete the junctions link-only before removing the directory,
since a worktree's `node_modules` entries are junctions into the primary
tree and a recursive delete through them takes the primary tree's packages.

**Rejected: sweeping working directories automatically.** A directory whose
branch merged can still hold uncommitted work, and there is no undo.

### The sweep runs where a reading already runs

Both hosts call the reading when they read the workspace, and again on an
interval: the extension host on activation and every
`LEFTOVER_SWEEP_INTERVAL_MS`, the server on start and on the same interval.
The interval is one value in core, beside the other intervals, so the two
hosts cannot drift.

A sweep that fails is not an error the person has to answer: it is reported
in the same panel as what it found, the way a failed reading already is.

## Risks / Trade-offs

- **A leftover that a person meant to keep.** Only a directory whose change
  is already archived and whose files are all the product's own is removed,
  and what goes is named in the panel after it goes.
- **The archive check costs a reading of the archive.** The archive is
  already read by the same discovery, so the check is a lookup, not a
  second walk.
- **A working directory may look finished and not be.** Nothing is removed
  without a press, and the reason is shown beside the press.
- **Two hosts sweeping one workspace.** The sweep is idempotent: a
  directory already gone is not an error, and the product's own lease is
  not involved, because nothing here writes into a change.

## Protocol

No command or event of the run protocol changes. The REST surface gains two
routes, `POST /api/workspace-leftovers` and `POST /api/workspace-leftovers/
remove`, and the editor's Changes view reads the same core function
directly.
