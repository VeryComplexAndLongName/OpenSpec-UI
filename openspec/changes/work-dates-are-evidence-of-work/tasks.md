Found by measuring the field the day after it shipped: it reported the
proposal date under a different name, for all 185 changes.

## 1. The correction

- [x] 1.1 Evidence of work is a ticked task or a recorded run. The
  evidence field is renamed with it, so passing every line instead is a
  type error rather than a silent zero.
- [x] 1.2 Both sources can win: a run recorded before the first tick
  reports the run.

## 2. Tests

- [x] 2.1 A change whose tasks were written on one day and ticked on
  later ones dates its work from the ticks, not from the file.
- [x] 2.2 A run recorded before any tick wins, and says it came from the
  audit log.
- [x] 2.3 A change with no ticked task and no run reports no work dates
  rather than falling back to the file.

## 3. Verification

- [x] 3.1 `openspec validate --strict --changes`.
- [x] 3.2 `npm run verify` unpiped, after the last edit, with everything
  staged.
  Run 2026-09-09: exit 0 — 48 cli, 796 core, 302 extension, 68 server,
  322 webui.
- [x] 3.3 Re-measure over this repository and record both numbers, so
  the correction is visible rather than asserted.

  | Span | Before (every blame line) | After (ticked tasks and runs) |
  | --- | --- | --- |
  | proposed to first worked | median 0.00d, p90 0.00d, max 0.00d | median 0.00d, p90 0.18d, max 2.06d |
  | first to last worked | median 0.00d, p90 1.46d, max 5.50d | median 0.00d, p90 1.10d, max 5.40d |

  185 changes carry work dates and one does not — this change itself,
  whose tasks were unticked when the measurement ran. That is the
  behaviour the correction is for: a task list that exists is not
  evidence that anything was done.

  135 of the 185 still sit at exactly zero days from proposal to first
  tick. That is not the defect returning: those changes were proposed
  with tasks already ticked in the same commit, which is what this
  repository's own history looks like.
- [x] 3.4 Version bump via `npx changeset` for `core`.
