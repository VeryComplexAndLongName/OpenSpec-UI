Asked by the owner on 2026-09-26: the board's reads are slow. Measured:
`change-stages` 9.1 s, most of the board's wait.

## 1. The stages, sooner

- [x] 1.1 `getAddedFileDates`: every file's addition under
  `openspec/changes`, the archive left out, from one `git log`.
- [x] 1.2 `readStageFacts` dates the proposal, the task list and the
  directory from it; a file on disk it does not name is asked about with
  `--follow`, for a change renamed into place.
- [x] 1.3 A working tree's changes read six at a time; every working tree
  at once, merged in the order given.

## 2. Checks

- [x] 2.1 Tests: the additions read once give the same visits as reading
  file by file; a change renamed into place keeps its first date.
- [x] 2.2 Measured live against this repository on 2026-09-26, the
  standalone server from this worktree, each read alone: `change-stages`
  9.8 s and 9.1 s before, 1.9 s and 2.1 s after; the other reads unchanged.
- [ ] 2.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0.
- [ ] 2.4 The extension's integration suite, and the whole standalone
  browser suite.
- [ ] 2.5 `openspec validate the-board-reads-quickly --strict`, and the
  merge gate locally with `--base origin/main`.
- [x] 2.6 A changeset: core and the extension, patch.
