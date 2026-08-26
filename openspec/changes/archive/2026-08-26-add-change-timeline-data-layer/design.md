## Context

Researched directly against this codebase: `packages/core/src/git.ts`
has no blame/log today (only `status`/`diff`/`commit`/`currentBranch`);
`packages/core/src/task-checklist.ts`'s `TaskChecklistItem` has no date
field; archive folders are named `openspec/changes/archive/
YYYY-MM-DD-<name>/` (verified directly against this repository's own
archive, e.g. `2026-08-26-add-cli-help-flag`).

## Goals / Non-Goals

**Goals:**
- One core module computes everything both the single-change and
  multi-change UI phases need, so neither later phase touches this
  layer for its data needs.
- Every date is best-effort: a git failure, shallow clone, or
  undeterminable line degrades to `null`/`undefined`, never an error
  that blocks the rest of the read.
- No duplicated path-resolution logic for active vs. archived changes —
  reuse the exact join pattern `workbench.ts` already uses.

**Non-Goals:**
- Not building any UI in this change (single-change and multi-change
  views are separate, later changes).
- Not persisting task-completion timestamps anywhere (e.g. writing a
  date into `tasks.md` when a box is checked) — this change only reads
  existing git history, it does not change how tasks are authored or
  checked off.
- Not attempting perfect per-task dates for squash-merged history — a
  squash commit legitimately attributes every task it touched to one
  timestamp; this is treated as correct, not a bug to work around.

## Decisions

### Use `simple-git`'s `.raw()` for blame, not the thin `GitWrapper`

`packages/core/src/git.ts`'s `GitWrapper` interface is deliberately
narrow ("only what the UI actually needs"). Blame is a one-off, so this
follows `checkpoint.ts`'s existing precedent of calling
`simpleGit(cwd).raw([...])` directly for a command outside that
narrow surface, rather than growing `GitWrapper`'s public interface for
a single caller.

### Do not extend the `Command`/`Event` protocol (`protocol.ts`)

That protocol is built for spawned/streaming work (`started/stdout/
stderr/progress/completed/failed/cancelled`) — used for agent runs and
CLI-backed reads like `show`/`list`/`validate`, which shell out to the
`openspec` CLI and stream its output. A git-blame-based, in-process
computation doesn't shell out to anything external; forcing it through
a streaming-event shape would be a worse fit than the plain
async-function-plus-REST-handler pattern already used for
`/api/change-editor/read`, which this change follows instead.

### Do not extend `change-editor-store.ts`'s `readChangeEditorDocument`

It resolves only the **active** change path (no `archived` parameter),
and its sibling `saveChangeEditorDocument` must never be able to write
into `archive/`. Rather than add an `archived` parameter that widens
what a save-capable module can reach, `change-timeline.ts` resolves
proposal/design/tasks/spec paths itself, using the same active/archive
join logic `workbench.ts`'s `discoverOpenSpecWorkspace` already applies
(via the exported `assertValidChangeName`), for a read-only module that
never writes.

### A task's date is only ever surfaced when it is checked

`git blame` reports when a line was *last touched*, not when a task was
*completed* — for a still-unchecked task that has never been edited
since it was first added, blame's date is that line's creation date,
which would misleadingly read as "done on this date" if shown as-is
(confirmed empirically by the real-git-repo test fixture below, which
initially asserted `null` and caught blame correctly returning the
creation-commit date instead). `getChangeTimeline` therefore always
forces `date: null` for any task where `done` is `false`, regardless of
what blame reports for that line.

### Blame is expected to follow the active→archive rename by default

`git blame` follows a file's rename history as part of its default
behavior (not an opt-in flag) as long as git recorded the move as a
rename (high content-similarity, which a pure directory move satisfies).
No `-C`/`-M` flags are added preemptively; the real-git-repo test
fixture (see Non-Goals above — this is exactly the thing to verify
empirically, not assume) exercises an active-change-then-archived
scenario to confirm blame still resolves dates after the move.

## Risks / Trade-offs

- **[Risk]** A shallow clone (`git clone --depth`) or a squashed/rebased
  history could make `blameLineDates`/`getChangeCreatedDate` return
  `undefined`/`null` even for tasks that do have a "real" date in the
  original (pre-squash) history. → **Mitigation**: this is the accepted,
  discussed trade-off (see the user's own confirmation that a sparse
  2-3-milestone result is fine) — never surfaced as an error, always a
  clean `null`.
- **[Risk]** The `--line-porcelain` output format is easy to parse
  incorrectly (metadata line count varies per block; only the first
  occurrence of a given commit in the whole blame output includes the
  full metadata block, later occurrences are abbreviated). →
  **Mitigation**: the parser tracks `author-time` per commit sha (not
  purely positionally) the first time it's seen, and reuses it for
  every later line attributed to the same sha — verified against a real
  git fixture, not a hand-typed sample string, in the test suite.
