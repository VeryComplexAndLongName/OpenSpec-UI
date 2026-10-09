From ADR 0045, amended; the table of labels approved by the owner on
2026-10-09.

## 1. Core

- [x] 1.1 `action-vocabulary.ts`: the verbs Schedule (Run) and Save (Set
  up), and the nouns the web UI's buttons act on.
  Main, Landed Changes, Logs, Path, Done Tasks, Chain, Agents, Command,
  Proposal, Design, Stage Agents, Settings, Templates, Summary,
  Configuration, Processes; `action-vocabulary.test.ts` and the message
  register's tests pass, 11 tests (2026-10-09).

## 2. Web UI

- [x] 2.1 Every button outside a dialog is a pair, with its accessible name
  starting with its visible words: the Pipeline's toolbar and cards, the
  waiting banner, the chain and AI panels, the task list, Processes, the
  harness settings, the hints, the run dialog, the enrolment requests and
  the standalone app.
  17 components and `standalone-entry.tsx` (2026-10-09).
- [x] 2.2 Inside a dialog or beside a prompt, a button is its verb alone.
  Answer, Allow, Deny on the card and the banner; Archive, Delete,
  Rollback, Cancel and Close in the dialogs.
- [x] 2.3 Archive Landed Changes..., Delete History..., Rollback
  Process..., Delete Leftover... and Delete Worktree... ask in a
  `ModalLayer` dialog before they act.
  `PipelineView.tsx`, `ProcessesView.tsx`, `LeftoverList.tsx`; their tests
  check that nothing is done before the dialog's submit (2026-10-09).
- [x] 2.4 `control-vocabulary.test.ts`: every button's words are a pair, a
  verb inside a dialog, a switch or a state; a Danger verb carries the
  dots; the scan finds the labels it is meant to.
  3 tests, 0.3 s (2026-10-09).
- [x] 2.5 The tests that find a button by its name follow.
  The web UI's unit tests and the server's e2e specs; PipelineView 101,
  ProcessesView 13, LeftoverList and the vocabulary test pass with two
  workers (2026-10-09).

## 3. Extension and documents

- [x] 3.1 The confirm-key prompt's title reads "Confirm Key".
  `extension.ts` (2026-10-09).
- [x] 3.2 README, the extension's README, the server's README and
  `docs/how-to/stop-a-run.md` name the buttons by their new words.
  Published articles and earlier ADRs keep theirs (2026-10-09).
- [x] 3.3 ADR 0045 amended: the web UI's buttons, the verb alone in a
  dialog, Danger asks first, the new verbs and nouns.
  "Amended on 2026-10-09 (every-control-is-a-verb-and-a-noun)".
- [x] 3.4 A changeset: core, webui, extension - minor.
  `.changeset/every-control-is-a-verb-and-a-noun.md`; `check-changesets`
  passes (2026-10-09).

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint`.
  2026-10-09: typecheck clean; lint 0 errors (4 warnings, none in files
  this change touched).
- [x] 4.2 `openspec validate every-control-is-a-verb-and-a-noun --strict`,
  and the merge gate with the worktree's absolute path as `--cwd`.
  2026-10-09: valid under `--strict`; the gate, run as `openspec-ui-cli
  validate changes`, named only 4.2 and 4.3 as open.
- [x] 4.3 **Human-only**: in VS Code and in the standalone app, the
  Pipeline's toolbar and a card read as verb-noun pairs, and Archive
  Landed Changes... asks in a dialog before it archives.
  2026-10-09, the owner, on the extension 0.100.0 and the standalone app
  built from this branch: "All fine". A deletion opened its confirmation
  dialog, and confirming it deleted with no further window.
