## Context

`getArchivedChangeSummary(workspaceRoot, changeName)` was written for a caller
that has only a name. It discovers the workspace, finds the change, parses its
`tasks.md` and reads a modification time. The overview handler already holds
the discovered workspace and calls it once per archived change, all at the
same time.

## Goals / Non-Goals

**Goals:**

- The overview request discovers the workspace once, however many changes are
  archived.
- The summaries it returns are the same values as today, field for field.

**Non-Goals:**

- Caching a workspace across requests. A cache needs an invalidation story,
  and one read of this repository takes under a second.
- Changing how a tab reports that it is reading
  (`a-screen-says-what-it-is-doing`).

## Decisions

### Summarise from a workspace already read

`getArchivedChangeSummaries(workspace: OpenSpecWorkspace)` maps
`workspace.archivedChanges` through one private `summaryOf(change)`: find the
`tasks` artifact, parse it if it exists, and stat `tasks.md` or else the
change directory. `getArchivedChangeSummary` becomes a discovery followed by
`summaryOf` on the one change it names.

- **Why a workspace, not a root.** The function cannot then rediscover, and a
  test can prove it: given a workspace whose root does not exist on disk but
  whose changes do, it still returns their counts.
- **Why keep the single-name function.** It is exported from core and has its
  own tests. Removing it would widen a performance fix into an API change.

Rejected: an optional third `workspace` argument on the existing function. A
caller that forgets it gets the quadratic path back without any sign.

### No concurrency limit

The 250 per-change reads are one `readFile` and one `stat` each, about 500
file operations. The `EMFILE` came from 250 full discoveries running side by
side, not from this, so a limiter would add code without a measured need.

## Risks / Trade-offs

- **The summary reads a snapshot.** It uses the workspace from the start of
  the request, not a fresh read per change. That is the same moment
  `archivedChanges` itself reports, so the names and their summaries now
  agree by construction.
