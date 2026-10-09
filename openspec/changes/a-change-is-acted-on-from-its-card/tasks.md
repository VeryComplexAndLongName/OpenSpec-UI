From ADR 0044, accepted by the owner on 2026-10-08; both hosts, and writes
where the change is worked, chosen on 2026-10-09.

## 1. Core

- [x] 1.1 `change-actions.ts`: every action on a change, its group, icon,
  writing and confirmation; `changeActionStates` with the reasons. Tests.
  19 actions; `change-actions.test.ts`, 6 tests (2026-10-09).
- [x] 1.2 `workedElsewhere`, `refuseToWrite` refusing only where records do
  not check out, and `changeActionRoot` for a host. Tests.
  `change-ownership.test.ts` 18 tests (2026-10-09).
- [x] 1.3 `PIPELINE_CARD_REM`: the actions' gap and rows; the card's height
  counts them. `renderChangeCostReport` and `changeAncestry` move to core;
  the noun Actions joins the vocabulary.

## 2. The card

- [x] 2.1 `CardActions.tsx`: two rows of icons grouped and coloured by
  group, dimmed with the reason, Run Change left to Start; Danger actions
  confirmed in `ConfirmActionForm`. Styles held to core's lengths.
- [x] 2.2 `Codicon.tsx` and `codicons.generated.ts`, from
  `scripts/extract-codicons.py`; a test that every action's icon has an
  outline. The outlines were rendered and looked at (2026-10-09).
- [x] 2.3 `PipelineView.tsx`: the actions on this checkout's cards and on a
  board card of a change's own worktree. `PipelineView.actions.test.tsx`,
  5 tests; the Pipeline's 108 and the card style's 9 pass (2026-10-09).

## 3. VS Code

- [x] 3.1 Every change command acts where the change is worked
  (`workedIn`); Archive, Rollback and Delete do not ask again when the card
  confirmed. Tests in `commands.test.ts`: 171 pass (2026-10-09).
- [x] 3.2 The Pipeline card's action runs the row's command on the change as
  a row carries it (`change-action-target.ts`, `pipeline-panel.ts`); the
  embed relays it, from its own origin only. Test in
  `pipeline-panel.test.ts`, 40 pass.
- [x] 3.3 The change's harness panel reads and writes where the change is
  worked.
- [x] 3.4 Show Actions...; the menus: Show Actions first and inline, what
  runs, Inspect and Set Up submenus, Danger last; rows worked elsewhere
  offer everything; their icon is a branch, not a lock.
  `change-actions-parity.test.ts`, 3 tests; `one-way-in.test.ts` and the
  vocabulary test follow.

## 4. Standalone

- [x] 4.1 `/api/change-action`: each action where the change is worked;
  the harness routes too. `change-actions-rest.test.ts`, 5 tests.
- [x] 4.2 `ChangeActionDialog.tsx` over the Pipeline, asking first where an
  action asks; `standalone-entry.tsx` wires the card, and hands the action
  to the editor when embedded. `ChangeActionDialog.test.tsx`, 3 tests.

## 5. Documents

- [x] 5.1 ADR 0045 amended: the noun Actions.
- [x] 5.2 A changeset: core, webui, extension, server - minor.
- [x] 5.3 The three notifications this change adds are said by identifier
  (ADR 0046): `OSW-CHG-001` to `003`, the first of the `CHG` group;
  `docs/messages.md` regenerated, and the ratchet holds at 290.

## 6. Checks

- [x] 6.1 `npm run typecheck && npm run lint`; the affected core, webui,
  extension and server tests, with two workers.
  2026-10-09: typecheck clean; lint 0 errors (3 warnings, none in files
  this change touched). Extension: all 528; webui: all 748; server: all
  132; core: the 82 of the files touched. The full projects run in CI.
- [x] 6.2 `openspec validate a-change-is-acted-on-from-its-card --strict`,
  and the merge gate with the worktree's absolute path as `--cwd`.
  2026-10-09: valid under `--strict`; the gate named only 6.3 and 6.4 as
  open.
- [ ] 6.3 **Human-only**: in VS Code, on the Pipeline, a change's card shows
  its actions as grouped, coloured icons; a dimmed one says why; Delete
  Change asks first; Configure Change Harness on a change worked in its own
  worktree opens that worktree's settings; the Changes tree's menu starts
  with Show Actions... and has Inspect and Set Up submenus.
- [ ] 6.4 **Human-only**: in the standalone app, a card's Show Ancestry and
  Add Relation work over the Pipeline.
