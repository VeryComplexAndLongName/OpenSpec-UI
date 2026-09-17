## Context

`discoverOpenSpecWorkspace(root)` is the allowlist every path to a change's
artifacts comes from (`task-checklist.ts`'s header). It reads both lists,
active and archived, and for each change resolves its schema and matches
the files the schema declares. On this repository that is 0.8 s, almost all
of it the archive.

`readTaskChecklist(root, name, archived)` finds the one change it is named
by reading the whole workspace. That was cheap when the archive was small.
The survey calls it, and `tasksFilePath`, once each per change per working
directory; the Pipeline asks for a survey, and a standings reading asks for
another.

## Goals / Non-Goals

**Goals:**

- The Pipeline's readings return well inside the webview's 10 seconds on a
  repository with hundreds of archived changes.
- Every reading returns exactly what it returned before.
- Paths still come from a discovered change's artifacts, never from a name
  joined onto a directory.

**Non-Goals:**

- Raising `BRIDGE_REQUEST_TIMEOUT_MS`. A reading that takes a minute is the
  fault; a longer wait would only hide it.
- Caching readings across requests. Each reading stays a reading of the
  files as they are.
- Sharing one survey between the panel's survey and its standings. After
  this change a survey costs under a second; the rest of a standings
  reading is its pull request listing and fetch.

## Decisions

### Read one list when only one is needed

`DiscoverOpenSpecWorkspaceOptions.changes` chooses the list. The other list
is empty, and `archiveExists` and the rest of the workspace are read as
before. Choosing the list inside `discoverOpenSpecWorkspace`, rather than a
second discovery function, keeps one allowlist: a caller that reads one list
gets the same `WorkbenchChange` values the full reading gives for it.

`findTasksArtifactPath` asks for the list its `archived` argument names, so
`readTaskChecklist` and `tasksFilePath` get faster for every caller, the
harness chain runner, delegated items and the inbox included, with no change
at their call sites.

### A survey reads a directory, then its lists

`surveyChanges` reads the directory's active changes once, then reads each
change's `tasks.md` through `readTaskChecklistOf(change)`, which takes a
discovered change and returns its items and the path they came from. A
reading that fails marks every change of that directory unreadable with the
reason, as a failed per-change read did.

The change names still come from the directory listing, so a directory
under `openspec/changes` that discovery does not list is still a card with
no tasks, as before.

### Readiness takes capabilities from its own reading

`readChangeReadiness` already read the workspace. It now reads the active
list only and takes each change's delta-spec capabilities from that
reading's artifacts, against the same project root `listChangeArtifacts`
was given.

### The editor's views read what they show

Fixing the readings was not enough in the editor: with the OpenSpec view
showing, the panel still timed out. The extension host's CPU was idle more
than half the time; its readings were waiting on file operations. Counting
every reading of a workspace in a built extension found the Processes view
reading two whole workspaces for each of the 49 changes its process history
names, all at once.

- **The Processes view reads by name.** `readChangesNamed(root, names)`
  lists each list's directories and reads only those with a name it was
  given, preferring the active change. A redraw is one reading of a few
  changes, where it was 98 readings of the whole workspace.
- **The Changes view reads the active list, the Archive view the archived
  one.** And the Archive view reads again only for a file event inside
  `openspec/changes/archive`: a run ticking a task in an active change used
  to read all 256 archived changes again. Archiving creates the change's
  folder there, so an archive is still seen.
- **The survey and readiness read relations among active changes only.**
  Both already dropped a blocker that was not active; `readChangeGraph`
  read every archived `.openspec.yaml` to build nodes they dropped.

### A ceiling on how much one reading does at once

`discoverChanges` started every change's reading together. For the archive
that is 256 changes, each opening several files. `mapBounded` keeps the
order of the results and lets 16 run at a time. It is a guard, not the fix:
with the readings above, no view reads the archive often, and a reading
that does no longer takes every handle while it does.

A delay between readings was considered and not taken. It would slow every
reading by the delay, and a queue with a ceiling gives the same protection
without waiting when nothing else is running.

## Risks / Trade-offs

- **A caller that needs both lists and asks for one** would see an empty
  list. The option is opt-in, the default is unchanged, and each caller
  changed here reads only the list it looks in.
- **The counting test mocks `./workbench.js`.** It asserts how often and for
  which list the readings run; what they return is asserted by the files
  that already test them.
