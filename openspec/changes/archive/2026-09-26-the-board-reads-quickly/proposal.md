## Why

Asked by the owner on 2026-09-26, after the logs panel was found waiting
its turn behind the board: make the board's reads fast.

Measured on this repository on 2026-09-26, each read alone against the
standalone server, twice:

| Read | First | Second |
| --- | --- | --- |
| `change-stages` | 9.8 s | 9.1 s |
| `change-standings` | 4.7 s | 1.6 s |
| `overview` | 2.8 s | 2.6 s |
| `main-drift` | 2.6 s | 2.4 s |
| `worktree-survey` | 1.4 s | 1.1 s |

`change-stages` is most of it, and it is the board's own reading. Taken
apart: the working trees were read one after another (five here), and each
change cost about a second of git - two `git log --follow`, 360 ms each on
968 commits, a `git log` of its directory, 143 ms, and a `git blame` of its
task list, 146 ms.

## What Changes

- **One `git log` for every change of a working tree**:
  `getAddedFileDates` reads when each file under `openspec/changes` was
  added, the archive left out, in one process of about 170 ms. The
  proposal, the task list and the directory's first commit are dated from
  it.
- **`--follow` only where it answers something**: a file on disk that the
  one reading does not name may have been renamed into place, and only
  then is it asked about alone, so a renamed change keeps its first date.
- **Side by side**: a working tree's changes are read six at a time, and
  every working tree at once, merged in the order given so the host's own
  reading still wins.

`change-stages` falls from 9.1 s to 2.0 s here, with the same answer.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none - the same readings, sooner)

## Impact

- `packages/core/src/change-timeline.ts` (`getAddedFileDates`) and
  `change-stages.ts`, with tests.
- No host changes: both read the stages through core.

## Explicitly out of scope

- **`overview`**: two runs of the `openspec` CLI, about 1.8 s each, most of
  it Node starting. Reading those lists in process would change where they
  come from, which is a decision of its own.
- **`change-standings` and `main-drift`**: a fetch and the forge, over the
  network; their time is the network's.
