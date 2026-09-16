## 1. Core

- [x] 1.1 `packages/core/src/task-checklist.ts` exports
  `getArchivedChangeSummaries(workspace: OpenSpecWorkspace)`, returning
  `Array<{ name: string } & ArchivedChangeSummary>` in `archivedChanges`
  order, through a private `summaryOf(change)` that
  `getArchivedChangeSummary` also uses.

  Done on 2026-09-16. `getArchivedChangeSummary` is now a discovery followed
  by the same `summaryOf`.
- [x] 1.2 `packages/core/src/task-checklist.test.ts` asserts that
  `getArchivedChangeSummaries` returns, for two archived changes, the same
  values `getArchivedChangeSummary` returns for each.

  Done: two archived changes, one with `tasks.md` and one without, compared
  field for field.
- [x] 1.3 `packages/core/src/task-checklist.test.ts` asserts that
  `getArchivedChangeSummaries` reads from the workspace it is given: a
  workspace whose `root` does not exist, with a real change directory, still
  yields that change's counts.

  Done: the workspace is read, then handed over with `root` pointing at a
  directory that does not exist; the change still reports 2 of 3.
  - **Checks:** `task-checklist.test.ts` passes, 33 tests; core and server
    typecheck pass.

## 2. Server

- [x] 2.1 `packages/server/src/rest.ts`'s overview handler builds
  `archivedChangeSummaries` with `getArchivedChangeSummaries(workspace)` and no
  longer imports `getArchivedChangeSummary`.

  Done: one call on the reading the handler already made.

## 3. Checks

- [x] 3.1 `openspec validate the-summary-reads-the-workspace-once --strict`
  passes.

  Done on 2026-09-16: "Change 'the-summary-reads-the-workspace-once' is
  valid".
- [x] 3.2 The overview's archived-summary step, timed on this repository
  before and after. Record both figures. Before: 156,919 ms for 250 archived
  changes, measured on 2026-09-16.

  Done on 2026-09-16, same repository and machine, through tsx against the
  worktree's sources. After: 69, 115 and 84 ms for 250 summaries over 4,297
  tasks, with discovery itself at 788–935 ms.
- [x] 3.3 `npm run verify` passes, run unpiped. Record each package's count.

  Run on 2026-09-16, output redirected to a file. Typecheck and lint pass in
  every package. Tests: cli 161, core 1,480 (plus 4 in its scripts),
  extension 379, server 100, webui 503 of 504, and the root script suites.

  **The one webui failure predates this change and makes verify exit 1.**
  `build-metro-icons.test.mjs` compares a module stored with LF against its
  CRLF checkout on Windows, and fails identically on an untouched main. It
  passes on the Linux runner.
- [x] 3.4 A changeset: `@openspec-ui/core` patch, `@openspec-ui/server` patch,
  `openspec-ui-vscode` patch.

  Done: `.changeset/the-summary-reads-the-workspace-once.md`.
- [x] 3.5 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass.

  Done on 2026-09-16, after staging every file by name.
- [x] 3.6 The whole standalone browser suite passes. Record the count.

  Done on 2026-09-16: `npm run test:browser` in `packages/server`, 20 passed
  in 4.8 minutes.
- [x] 3.7 A live check against the standalone server started on this
  repository: open the OpenSpec view summary and record how long it takes to
  show its tiles.

  Done on 2026-09-16 with Chromium against `npm run start -- C:\Prog\OpenSpec-UI
  4317`: the tiles read Changes 3, Archived 250, Specs 16, and appeared 5,815
  ms after the tab was clicked. Before this change the same tab had shown no
  tiles after 25 s, with the server out of file handles.

  Where the rest goes, timed on its own the same day: `listChanges` 1,793–2,226
  ms and `listSpecs` 1,815–1,846 ms, each an OpenSpec CLI process, run side by
  side with discovery (508–575 ms); the summaries 51–66 ms. The other reads
  the tab starts when it opens make up the difference. The CLI listings are
  not this change's to shorten.
