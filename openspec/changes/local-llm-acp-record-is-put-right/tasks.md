# Tasks

## 1. OpenSpec Artifacts

- [x] 1.1 Write `openspec/changes/local-llm-acp-record-is-put-right/proposal.md`
  stating the measured cause (`owesNothing` false, 4.4 unrecorded) and the
  branch-name skip that let it land; verify `openspec status --change
  local-llm-acp-record-is-put-right` reports the proposal present.
  Done 2026-10-02: the proposal records both measurements and names
  `fix-local-llm-acp` as the branch the gate resolved nothing from.
- [x] 1.2 Write `openspec/changes/local-llm-acp-record-is-put-right/design.md`
  with `Non-Goals`, decisions naming their rejected alternatives, and
  `Risks / Trade-offs`; verify `openspec status --change
  local-llm-acp-record-is-put-right` reports the design present.
  Done 2026-10-02: three rejected alternatives are stated — teaching the
  rule to read the checkbox line, reopening 4.4, and archiving by hand.
- [x] 1.3 Write
  `openspec/changes/local-llm-acp-record-is-put-right/specs/openspec-workbench/spec.md`
  modifying `A change's task record states what has actually been done`
  so that a delegated or human-only item's evidence belongs under the
  item; verify `openspec validate local-llm-acp-record-is-put-right
  --strict` accepts the delta shape.
  Done 2026-10-02: the requirement gains the paragraph and the scenario
  `Evidence written on the checkbox line alone`; strict validation
  passes.

## 2. The record

- [x] 2.1 In `openspec/changes/local-llm-acp/tasks.md`, move item 4.4's
  record from the checkbox line to the indented lines beneath it. The
  record is moved verbatim: `git diff --word-diff` shows no word added or
  removed, only line breaks and indentation. Do not reword it, do not
  re-tick it, and do not touch any other item.
  Done 2026-10-02: `git diff --word-diff=porcelain` over the file,
  filtered to genuine `+`/`-` word lines, printed nothing — the move is
  whitespace only. No other item in the file is touched.
- [x] 2.2 `describeTaskDebts(parseTaskChecklist(...))` over the edited
  `openspec/changes/local-llm-acp/tasks.md` reports `unrecorded: []` and
  `open: []`, and `owesNothing` returns `true`. Record the output here —
  the edit looking right is not evidence that the rule reads it.
  Done 2026-10-02, running `packages/core`'s own
  `parseTaskChecklist`/`describeTaskDebts`/`owesNothing` from source over
  the edited file: `owesNothing: true`, `open: []`, `unrecorded: []`. The
  same script against `main` at `513a5c96` returns `owesNothing: false`
  with 4.4 in `unrecorded`.
- [x] 2.3 `npm run start --workspace @openspec-ui/cli -- validate --cwd
  <this worktree> --change local-llm-acp` returns `"ok": true` with no
  `unrecordedItems`, where the same command on `main` returns
  `"ok": false`. This is the gate the sweep agrees with; record both
  results here.
  Done 2026-10-02. On `main` (`--cwd C:\Prog\OpenSpec-UI`): `"ok": false`,
  `local-llm-acp` `"valid": false` with 4.4 under `unrecordedItems`, exit
  code 1. In this worktree: `"ok": true`, both `local-llm-acp` and
  `local-llm-acp-record-is-put-right` `"valid": true`, `failedItems` 0.

## 3. The runbook

- [x] 3.1 `openspec/README.md`: in "A branch ends with its pull request",
  say that the branch carries the change id verbatim because the merge
  gate resolves the change from the branch, and that a branch named
  anything else makes the gate skip the open-item check instead of
  failing. Name `fix-local-llm-acp` as the measured case.
  Done 2026-10-02: a paragraph added directly under "One change is one
  pull request", naming `--change "$GITHUB_HEAD_REF"` in `quality.yml`,
  why an unmatched name is skipped rather than failed, and the
  2026-10-01 landing of `local-llm-acp` from `fix-local-llm-acp` with a
  green gate.

## 4. Verification

- [x] 4.1 Run `npm run typecheck --workspaces --if-present` and record the
  result here.
  2026-10-02: exit 0, all five workspaces, no diagnostics.
- [x] 4.2 Run `npm run lint --workspaces --if-present` and record the
  result here, including `lint:english` over the new markdown.
  2026-10-02: exit 0 — 0 errors, the same 3 pre-existing unused-var
  warnings in `packages/core` that `main` already has. Root `npm run
  lint` also passed its script checks (test budgets, openspec config,
  publish workflow, articles). `npm run lint:english`: "English policy
  check passed."
- [x] 4.3 Run `npm run test --workspaces --if-present` and record the
  result here. The relations test in `packages/core` must accept the
  `follows: local-llm-acp` this change states.
  2026-10-02: exit 0, nothing failed — cli 192, core 2011 and 62 in its
  git-fixture project, extension 499, server 118, webui 687; 287 test
  files, all passed. The relations test passed with `follows:
  local-llm-acp` stated in `.openspec.yaml`, which is what proves the id
  resolves.
- [x] 4.4 Run `openspec validate --changes --strict` and record that both
  active changes pass.
  2026-10-02: "change/local-llm-acp" and
  "change/local-llm-acp-record-is-put-right" both tick; "Totals: 2
  passed, 0 failed (2 items)".
