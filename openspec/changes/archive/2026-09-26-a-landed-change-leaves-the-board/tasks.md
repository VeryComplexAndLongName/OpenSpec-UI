Reported by the owner on 2026-09-26: finished changes stood on the board
long after main archived them.

## 1. The board

- [x] 1.1 `settleOnDefaultBranch` in core: archived on the default branch is
  Archived, with no "since".
- [x] 1.2 The board settles the stages it reads with it.
- [x] 1.3 A copy in another working directory of a change main archived
  draws no card.

## 2. Checks

- [x] 2.1 Tests: the settling, and a reading left alone; a change of this
  checkout archived on main standing in Archived; a copy in another
  worktree drawn nowhere.
- [x] 2.2 Live, in the standalone: a worktree branched before an archive,
  and the board without its copies. 2026-09-26, a probe worktree at
  8830c9f9, which still held a-team-names-its-columns and
  the-local-llm-is-where-you-say, both archived on main since: the board
  stood them in Archived among the ten archived lately, and In progress held
  only the two changes still worked. The probe was removed after.
- [x] 2.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Typecheck 0, lint 0, test 0
  (core 1933, server 497, extension 118, webui 677).
- [x] 2.4 The extension's integration suite, and the whole standalone
  browser suite. Integration: 19 passing. Browser: 29 of 29; no picture
  changed, and the regenerated ones were left out.
- [x] 2.5 `openspec validate a-landed-change-leaves-the-board --strict`, and
  the merge gate locally with `--base origin/main`. Validate: valid; the
  gate exit 0.
- [x] 2.6 A changeset: core, webui, the server and the extension, patch.
