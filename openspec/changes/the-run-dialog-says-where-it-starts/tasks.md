Reported by a user on 2026-09-24: the Start window does not say what a
press will do, and with `assisted` it offers a chain that is refused.

## 1. Where a run begins

- [x] 1.1 `runStartStage` and `describeRunStart` in core; the chain runner
  resumes with `runStartStage`.
- [x] 1.2 `runStartFactsFrom`: the facts from a proposal and a task list,
  for both hosts; an empty list is no plan yet, an unreadable one is left
  to apply.
- [x] 1.3 The plan carries `startsAt` where the host read the change, and
  the dialog says it.

## 2. A chain under `assisted`

- [x] 2.1 Not offered, nor scheduled; `withheld` says why and which setting
  offers it, and the dialog says it.

## 3. Checks

- [x] 3.1 Tests: the three stages and an unknown count; the sentences; the
  facts from a proposal and a task list; `startsAt` present only where read;
  the chain withheld under `assisted` and offered otherwise; the dialog's
  two lines and their absence; the standalone reading a change 65 of 66
  done and one never proposed.
- [x] 3.2 Live, in the standalone and in the editor: the dialog for a change
  with open tasks under `assisted`, saying where it continues and that no
  chain is offered. 2026-09-25, this worktree's own change, 4 tasks open,
  under the repository's `assisted` harness. Standalone: "Continues at
  apply: 4 tasks still open.", the chain withheld with its reason, and only
  "Run one stage (configured)" offered. Editor, the Extension Development
  Host built from this worktree: the same two sentences, with "Run one
  stage (configured)" and "Implement with the VS Code agent" offered.
- [x] 3.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Typecheck 0, lint 0. Test 0 on
  the second run (core 1912, server 493, extension 116, webui 672); the
  first failed one case of `landed-archive.test.ts`, the workspace sweep
  leaving an archive to another host, which this change does not touch and
  which passed alone, 29 of 29.
- [x] 3.4 The extension's integration suite, and the whole standalone
  browser suite. Integration: 19 passing. Browser: 29 of 29. Kept
  `run-dialog.png`, which now says where the run continues.
- [x] 3.5 `openspec validate the-run-dialog-says-where-it-starts --strict`,
  and the merge gate locally with `--base origin/main`. Validate: valid; the
  gate exit 0.
- [x] 3.6 A changeset: core, webui, the server and the extension, minor.
