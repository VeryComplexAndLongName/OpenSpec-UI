Reported by a user on 2026-09-24: four warning lines differing in one
word, in the settings and again in the run dialog.

## 1. Said once

- [x] 1.1 `groupHarnessFindings` in core: one kind, one agent, the same
  words but for the stage, said as one sentence naming every stage.
- [x] 1.2 The settings' warning and the run dialog say the groups; one
  stage's finding reads as it did.

## 2. Checks

- [x] 2.1 Tests: the user's own configuration giving four findings and one
  sentence; findings that differ in kind or agent kept apart, in stage
  order; a single finding's words unchanged; the settings view drawing one
  line for four stages.
- [x] 2.2 Live, in the standalone: the settings and the run dialog for
  claude-cli on every stage with a dollar budget, one line each.
  2026-09-25, this worktree with that harness written for the check and
  restored after it: Harness settings and the run dialog each said one line,
  "no spending ceiling can act on "propose", "review", "apply" and
  "verify" however large the spend.".
- [x] 2.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Typecheck 0, lint 0, test 0
  (core 1912, server 493, extension 116, webui 670).
- [x] 2.4 The extension's integration suite, and the whole standalone
  browser suite; the regenerated pictures that show a warning kept.
  Integration: 19 passing. Browser: 29 of 29. Kept `run-dialog.png`, whose
  three unbounded-stage lines are now one; the settings pictures show a
  single finding, unchanged, and were left out.
- [x] 2.5 `openspec validate a-warning-is-said-once --strict`, and the merge
  gate locally with `--base origin/main`. Validate: valid; the gate exit 0.
- [x] 2.6 A changeset: core, webui, the server and the extension, patch.
