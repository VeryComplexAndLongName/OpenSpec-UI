Asked by the owner on 2026-09-23: the kanban is fine, but where are the
archived changes in Archived? Nowhere, and by construction.

## 1. Reading the archive

- [x] 1.1 The day comes from the archived directory's own name; a name
  with no date is left out rather than dated by a guess.
- [x] 1.2 Read from the default branch on the server, so every machine
  that has fetched sees the same archive.
- [x] 1.3 Where that branch cannot be read, this working directory's
  archive is read, and the reading says which it is.
- [x] 1.4 The words and the arithmetic in a leaf the browser can have; git
  and the filesystem in the reader beside it.

## 2. What the column draws

- [x] 2.1 The recent ones, each saying the day it was archived, offering
  no action.
- [x] 2.2 Bounded twice: a window of days and a count. Everything not
  drawn is counted in one line beneath the board.
- [x] 2.3 The arrangement by declared order draws none of it.

## 3. Checks

- [x] 3.1 Tests: the name read and the name refused; the window's edges;
  the cap; the fall back to this directory and what it says; the column,
  the count line, and their absence in the other arrangement.
- [x] 3.2 Live, 2026-09-23, against this repository: 325 archived changes,
  10 drawn in Archived - today's own - and "315 more in the archive". A
  first attempt with the window alone drew 75, which is what made the cap
  a measurement rather than a preference.
- [x] 3.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Typecheck 0; lint 0 (three
  warnings, in files this change does not touch); test 0 on the second run -
  the first failed on `delegated-item-reply.test.ts` alone, which passes by
  itself and passed in the full rerun (core 1894, server 493, extension 116,
  webui 664).
- [x] 3.4 The extension's integration suite, and the whole standalone
  browser suite. Integration: 19 passing in a real VS Code host, exit 0.
  Browser: the first full run failed one of 29 (`pipeline.spec.ts` "starts a
  chain from its card"), which passes by itself; the second full run passed
  29 of 29, exit 0.
- [x] 3.5 `openspec validate the-board-remembers-what-was-archived
  --strict`, and the merge gate locally with `--base origin/main`. Validate:
  valid. The gate refused while 3.3-3.5 were open, as it should, and
  passed with exit 0 once they were ticked.
- [x] 3.6 A changeset: core, webui, the server and the extension, minor.
