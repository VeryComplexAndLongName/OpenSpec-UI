Path this change must hold end to end: the Cancel button → a `cancel`
command carrying the **active** `runId` → the same transport the run was
started on → `agent-runner.ts`'s cancel branch → the run's `AbortSignal`
→ the terminated process. A button that sends a cancel on a fresh or
missing `runId` renders correctly, passes a shallow test, and cancels
nothing.

Note on local checks: `npm run lint` currently fails here with `ENOENT ...
openspec/changes/agent-detection-timeout/.openspec.yaml`, from a
concurrent session's uncommitted archive moves. Unrelated to this change —
do not try to fix it, and do not mark a task complete on it.

## 1. The control

- [x] 1.1 `packages/webui/src/components/AiPanel.tsx`: add a helper that
  reads `runIdRef.current`, returns immediately when it is null, and sends
  `{ kind: "cancel", cwd, runId, context: { changeDir: effectiveChangeDir,
  promptContext } }` through `transport.send`. Mirror
  `HarnessChainPanel.tsx`'s `sendOnCurrentRun` — do **not** generate a new
  run id here; a cancel names the run it cancels.
- [x] 1.2 Same file: render a Cancel button in the existing
  `openspec-ai-panel-controls` row, beside Run, only while `isRunning`.
  Reuse that derived value; do **not** introduce a second notion of
  "a run is in flight" alongside it.
- [x] 1.3 Same file: give the button `data-testid="cancel-run-button"`,
  matching the naming of `run-button` and the chain panel's
  `cancel-chain-button`.
- [x] 1.4 Same file: do **not** re-check `isRunning` inside the click
  handler to suppress a cancel for a run that just ended.
  `agent-runner.ts` already treats a cancel for an unknown `runId` as a
  no-op yielding `cancelled`, deliberately, because that race is
  inherent — a second guard here would duplicate a decision made in core
  and drift from it.

## 2. The extension command's title

- [x] 2.1 `packages/extension/package.json`: change
  `openspec-ui.cancelProcess`'s title from "OpenSpec UI: Cancel Process"
  to one naming what it cancels — an implementation session — since
  `commands.ts` routes it to `deps.implementationSessions.cancel(...)`
  and it does not reach a harness run.
- [x] 2.2 Do **not** change what that command does, its `when` clause, or
  its command id. A command id is referenced from menus and possibly from
  a user's own keybindings; this task is a title, nothing more.

## 3. Tests

- [x] 3.1 `packages/webui/src/components/AiPanel.test.tsx`: while a run is
  in flight, the Cancel button is present; before any run and after a
  terminal event, it is absent.
- [x] 3.2 Same file: clicking Cancel sends exactly one command with
  `kind: "cancel"` **and the same `runId` the run was started with**.
  Assert the run id explicitly — a test that only checks `kind` passes
  even if the button generates a fresh id and cancels nothing.
- [x] 3.3 Same file: the cancel command carries the same `changeDir` the
  run was started with, including the `list` case where it is the changes
  root rather than a change directory.
- [x] 3.4 Same file: a run that reaches a terminal event and is then
  cancelled — by a click that raced the event — sends the command without
  throwing, and the panel still shows the terminal state.
- [x] 3.5 `packages/extension`: whatever test asserts the contributed
  command titles is updated for the new title, and no test asserting the
  command **id** changes.

## 4. Verification

- [x] 4.1 `openspec change validate --strict ai-panel-cancel-run`.
- [x] 4.2 `npm run typecheck` and `npm run test` — green across all four
  workspaces. See the note at the top of this file. `sprint-report.test.ts`
  and `change-timeline.test.ts` have pre-existing Windows timeout flakes
  at 5000 ms under load; do not attempt to fix them here.
- [x] 4.3 `git diff packages/core/` is **empty**. Cancellation behavior
  shipped in `harness-cancel-stops-the-run`; this change only makes it
  reachable, and a core diff means it reached further than it should.
- [x] 4.4 Version bump via `npx changeset` (`@openspec-ui/webui` and
  `openspec-ui-vscode`).
- [ ] 4.5 **Human-only, cannot be completed by an implementing agent**:
  with `autonomyLevel: "assisted"` — the setting under which no chain, and
  therefore no existing Cancel, is available — start a single stage from
  the AI panel, press Cancel, and confirm from the process list that the
  agent's process is gone and that no second agent process was spawned by
  the cancel. This is the check `harness-cancel-stops-the-run` task 6.5
  could not perform, because the control did not exist.
