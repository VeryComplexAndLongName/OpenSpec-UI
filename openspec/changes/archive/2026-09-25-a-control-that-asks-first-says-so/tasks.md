Reported by a user on 2026-09-24: a control that opens a dialog should say
so with three dots, as every menu does.

## 1. The controls

- [x] 1.1 A card's Start and both Stops read "Start..." and "Stop...";
  their accessible names are unchanged.
- [x] 1.2 The standalone's "Run with Agentic Harness...".
- [x] 1.3 The editor's command titles: each handler read for what it asks
  before acting; the twenty-two that ask gain "...", and the two written
  with the ellipsis character get three full stops.
- [x] 1.4 `HARNESS.md` and `docs/how-to/stop-a-run.md` quote the new titles.

## 2. Checks

- [x] 2.1 Tests: the card's Start and Stop words with their names kept;
  every command that asks ending in "...", no other, and no ellipsis
  character in any title; Run's title.
- [x] 2.2 Live, in the standalone and in the editor: the card's Start and
  Stop, and the command palette. 2026-09-25, this worktree's own change.
  Standalone: the card read "Start..." with its name "Start
  a-control-that-asks-first-says-so", and the Change Editor's button "Run
  with Agentic Harness...". Editor, the Extension Development Host built
  from this worktree: the palette listed "Add Relation...", "Configure
  Dependabot...", "Copy Tasks as Template Into...", "Create Change
  Template..." and "Create Change...", among others; the card's Start read
  "Start..." with the same name. A card's Stop appears only while a run is
  held, and its words are held by the card test.
- [x] 2.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Typecheck 0, lint 0, test 0
  (core 1914, server 496, extension 116, webui 672).
- [x] 2.4 The extension's integration suite, and the whole standalone
  browser suite; the regenerated pictures that show a card's controls kept.
  Integration: 19 passing. Browser: 29 of 29. Kept `pipeline.png`,
  `pipeline-board.png`, `pipeline-stop.png` and `run-with-harness.png`.
- [x] 2.5 `openspec validate a-control-that-asks-first-says-so --strict`,
  and the merge gate locally with `--base origin/main`. Validate: valid; the
  gate exit 0.
- [x] 2.6 A changeset: webui, the server and the extension, patch.
