Reported by the owner on 2026-09-23: a done change sits under "Step 1 - can
start now" (drawn with a middle dot then).

## 1. The heading

- [x] 1.1 The first column is headed "Step 1 - waits for nothing"; the
  others "Step N - after step N-1", with a plain hyphen.

## 2. Checks

- [x] 2.1 Tests: the three headings in core; the heading the browser
  suite looks for.
- [x] 2.2 Live against this repository: the picture's first column, over
  a change that is done. 2026-09-24, the standalone built from this
  worktree: the first column headed "STEP 1 - WAITS FOR NOTHING" (the
  stylesheet sets headings in capitals) over two cards. Neither was done
  at the time; the words no longer depend on what a card is doing.
- [x] 2.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Typecheck 0, lint 0, test 0
  (core 1894, server 493, extension 116, webui 665).
- [x] 2.4 The extension's integration suite, and the whole standalone
  browser suite; its regenerated Pipeline pictures kept. Integration: 19
  passing, exit 0. Browser: 29 of 29, exit 0. Kept `pipeline.png`,
  `pipeline-stop.png` and `pipeline-stop-ask.png`, the pictures that show
  the heading; the other screens are not this change's.
- [x] 2.5 `openspec validate a-column-says-what-it-means --strict`, and the
  merge gate locally with `--base origin/main`. Validate: valid; the gate
  exit 0.
- [x] 2.6 A changeset: core, webui, the server and the extension, patch.
