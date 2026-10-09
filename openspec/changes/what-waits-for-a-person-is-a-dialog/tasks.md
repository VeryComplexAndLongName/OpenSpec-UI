From ADR 0047, accepted by the owner on 2026-10-09.

## 1. The layer

- [x] 1.1 `ModalLayer.tsx`: backdrop, focus in and kept in, returned on
  close, Escape as Cancel, no close on a press beside it. Styles.
  `ModalLayer.test.tsx`, 2 tests (2026-10-09).

## 2. The Pipeline

- [x] 2.1 The answer, Stop and confirmation forms and a task shown whole in
  the layer, each `aria-modal`; the answer form says the change and how
  many questions.
- [x] 2.2 `WaitingBanner`: each change whose agent asks, with Answer, and
  each permission a held run waits on, with Allow and Deny, at the top and
  in sight; nothing while nothing waits. `answerTargetOf` and
  `permissionAskedOf` shared with the card. `PipelineView.waiting.test.tsx`,
  2 tests.

## 3. The hosts

- [x] 3.1 A run's logs in the layer, in the editor's Pipeline and the
  standalone app; the standalone app's run dialog, chain panel and change
  actions too.
- [x] 3.2 The run panel and the chain panel draw what their run waits for
  first (`WaitingForYou`), sticky. Test in `HarnessChainPanel.test.tsx`.

## 4. Documents

- [x] 4.1 A changeset: webui and extension - minor.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint`; the web UI's tests, with two
  workers.
  2026-10-09: typecheck clean; lint 0 errors (4 warnings, none in files
  this change touched). The web UI's 748 tests passed before the new ones
  were added; the 5 new ones pass. The full projects run in CI.
- [x] 5.2 `openspec validate what-waits-for-a-person-is-a-dialog --strict`,
  and the merge gate with the worktree's absolute path as `--cwd`.
  2026-10-09: valid under `--strict`; the gate named only 5.3 as open.
- [x] 5.3 **Human-only**: in VS Code's Pipeline, with an agent's question
  open, the top of the Pipeline says so without scrolling; Answer opens a
  dialog over everything that nothing behind can be pressed through, Tab
  stays in it and Escape closes it; Logs and Delete Change open as dialogs
  too.
  2026-10-09, the owner, on the extension built from this branch, with two
  open questions in the demo repository: all works as described.
