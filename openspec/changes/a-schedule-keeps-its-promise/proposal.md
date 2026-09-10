# A schedule keeps its promise

## Why

Found by the code review of 2026-09-10. `a-run-can-be-scheduled` shipped
with its browser test passing and its promise not met.

**It does not fire when the application is opened.** The dialog says "if
it is closed, the run starts the next time you open it"
(`RunDialog.tsx:218-219`). On open, `loadWorkspaceRoot` fills the
workspace root and stops (`standalone-entry.tsx:323-341`); the overview
is loaded only when someone leaves the root field, presses "Load
summary", or saves something. `fireDueRuns` correctly refuses to read the
schedule until the overview is known (`:549`) — so it refuses forever. The
browser test named "when the time passed with nothing open" fills and
blurs the root field, which a real reopen never does, and passes for a
reason the name does not state.

**A change archived after being scheduled is consumed silently.**
`stillExists` (`scheduled-runs.ts:66`) matches an archived change by
stripping its date prefix, so the entry is promoted to `start`. Both
hosts then delete the entry and look the change up under the unprefixed
name. The extension finds nothing and returns with no line in the output
(`scheduled-run-watcher.ts:73-78`); the shell opens a dialog on a
directory that no longer exists (`standalone-entry.tsx:568-576`,
`run-with-harness-dispatch.ts:55`). Schedule `demo` for 18:00, archive it
at 17:00: at 18:00 the schedule is gone and nothing says so. That is the
"schedule that quietly does not happen" the change existed to remove.

**The path chosen is stored and never read.** The dialog offers one
"Schedule" button per path (`RunDialog.tsx:200-208`) and the entry
carries `path`; at fire time both hosts reopen the dialog on the
configured resolution and the person chooses again. The spec says "it
starts at that time"; it opens a dialog at that time.

**The entry is consumed before the dialog is guaranteed.** The shell
removes the entry (`:568`) before resolving the dispatch (`:576`). A
malformed `harness.json` or a server error there prints "Reading the
schedule failed", which is not what failed, and the run is gone.

**The editor is pointed at the change without loading it.** `fireDueRuns`
sets `editorChangeName` only (`:569`); the files and revision of whatever
was loaded before stay. Save then posts change A's files under change B's
name, is refused by the hash check, and the person is told to reload —
which discards A's edits.

**The orchestration is written twice.** Read, drop, write back, pick due,
remove, describe waiting: once in `scheduled-run-watcher.ts:41-96`, once
in `standalone-entry.tsx:540-586`, down to the identical string. They
already differ in how they write back and in what they do with an
archived change. Core has the pure pieces and not the step where the
defects are.

Smaller, same feature: a lateness note set by a schedule is never cleared
by a manual start and reappears on the next dialog
(`standalone-entry.tsx:493-533`); neither host guards against two
overlapping passes; a dialog that opens by itself is not announced to a
screen reader and its messages are rendered only inside one tab; the
"not a time" branch of `checkScheduleTime` is unreachable from the dialog
because `toISOString()` throws first (`RunDialog.tsx:86`).

## Capabilities

### Modified

- Opening the application is enough for a due run to start: the schedule
  is read once the workspace is known, and the workspace is read on open.
- A scheduled change that has since been archived is dropped, and the
  drop says it was archived.
- The path chosen when scheduling is the path the run takes.
- An entry is consumed only once the run it names has been opened.
- Firing is one function in core; a host supplies what to open and where
  to say things.

## Out of scope

Running while nothing is running, and repeating schedules. Both were
excluded by `a-run-can-be-scheduled` and remain so.
