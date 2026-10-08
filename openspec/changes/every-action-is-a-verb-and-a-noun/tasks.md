From ADR 0045, accepted by the owner on 2026-10-08.

## 1. Core

- [x] 1.1 `action-vocabulary.ts`: verbs with group and icon, nouns,
  `readActionTitle`, `actionCommandId`, `actionCliForm`; exported from the
  root and the browser surface. Tests.
  `action-vocabulary.ts`, exported from `index.ts` and `browser.ts`;
  `action-vocabulary.test.ts`, 5 tests (2026-10-08).
- [x] 1.2 Hints, diagnoses, readiness, the supervisor, the operator-question
  refusal and the workflow rules agents are given name CLI subcommands by
  their pairs. Their tests.
  `hints.ts`, `failure-diagnosis.ts`, `change-readiness.ts`,
  `environment-report.ts`, `supervisor.ts`, `operator-questions-runner.ts`,
  `agent-workflow-rules.ts` and comments elsewhere; their tests follow - 14
  test files, 289 tests (2026-10-08).
## 2. Extension

- [x] 2.1 `package.json`: every command renamed to its pair, with id,
  category and icon; "Validate Change (Strict)" removed; menus follow.
  Generated from the ADR 0045 table: 66 commands, each with its pair,
  id, category and verb icon; menus and key bindings follow; no command
  names an id that is not contributed (2026-10-08).
- [x] 2.2 Every registration, reference and test follows; "Validate Change"
  asks for a change when none is selected.
  27 files of code, tests and documents follow; "Validate Change" falls
  back to asking for a change; `commands.test.ts` covers both ways.
- [x] 2.3 `action-vocabulary.test.ts`: titles, ids, category and icons
  hold to the vocabulary; no two titles alike. `one-way-in.test.ts` follows.
  `action-vocabulary.test.ts` in the extension, 4 tests; all 521 of the
  extension's unit tests pass (2026-10-08).
## 3. CLI

- [x] 3.1 `subcommands.ts`: pairs routed to handlers, former names refused
  with `OSW-CLI-001`, `publicNameOf` for messages. `main.ts`: routing,
  usage text. Tests in `subcommands.test.ts`; existing tests use the pairs.
  `subcommands.ts` and `subcommands.test.ts` (6 tests); all 217 of the
  CLI's tests pass (2026-10-08).
- [x] 3.2 Every CLI message that names a subcommand names its pair.
  Through `publicNameOf`: `run change requires a change name`, `reopen
  change requires --stage ...`, `stop run needs a reason ...`, and the rest.
## 4. Documents and workflows

- [x] 4.1 The merge gate's and the release manifest's workflows (GitHub and
  Gitea) use the new subcommands.
  `.github/workflows/quality.yml` (the gate, the manifest) and
  `.gitea/workflows/quality.yml`.
- [x] 4.2 README, HARNESS.md, the how-to pages, `openspec/README.md` and the
  extension's README name commands and subcommands by their pairs.
  README.md (14), HARNESS.md (10), five how-to pages, the extension's
  README, `openspec/README.md`.
- [x] 4.3 ADR 0045 amended: the filters told apart, the nouns completed.
  ADR 0045: the three filters told apart, the nouns completed, and an
  "Amended on 2026-10-08" note.
- [x] 4.4 A changeset: core, extension, cli, webui, server - minor, marked
  breaking, with the renaming.
  `.changeset/every-action-is-a-verb-and-a-noun.md`; `check-changesets`
  passes.
## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint`; the extension's, the CLI's,
  and the affected core and webui tests, with two workers.
  2026-10-08: typecheck clean; lint 0 errors (3 warnings, none in files
  this change touched). Extension 521, CLI 217, core 289 + 5, webui 106
  tests pass, with two workers. The full projects run in CI.
- [x] 5.2 `openspec validate every-action-is-a-verb-and-a-noun --strict`, and
  the merge gate with the worktree's absolute path as `--cwd`.
  2026-10-08: valid under `--strict`; the gate, run as `openspec-ui-cli
  validate changes`, named only 5.2 and 5.3 as open.
- [ ] 5.3 **Human-only**: in VS Code, the context menu of a change and the
  palette read as verb-noun pairs, and "Validate Change" from the palette
  asks for a change.
