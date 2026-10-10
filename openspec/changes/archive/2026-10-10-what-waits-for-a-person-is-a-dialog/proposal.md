## Why

The owner, on 2026-10-09: to see what blocks a run, one scrolls to the
bottom of the Pipeline - with many changes, further - and nothing stops one
from going elsewhere while a question waits. "This applies to everything:
block the person's actions and wait for the answer." ADR 0047, accepted the
same day, decides that what waits for a person is a modal dialog, opened at
once by the person's own press, and that an agent's question is announced
at the top, not opened by itself.

## What Changes

- `ModalLayer` in the web UI: over the whole view, the view behind dimmed
  and unpressable; focus moved in, kept in with Tab, and returned on close;
  closed by the dialog's answer or Cancel, or Escape - never by a press
  beside it.
- The Pipeline's answer, Stop and confirmation forms, a task shown whole,
  and a run's logs open in it, in both hosts; so do the standalone app's
  run dialog, chain panel and change actions. Every one carries
  `aria-modal`; the answer form says the change and how many questions.
- The top of the Pipeline says what waits for a person: each change whose
  agent asks, with Answer opening the dialog, and each permission a run
  held here waits on, with Allow and Deny. It stays in sight as the picture
  scrolls; nothing is said while nothing waits.
- The run panel and the chain panel draw what their run waits for first,
  and keep it in sight.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-ui`: what waits for a person is a modal dialog; the Pipeline says
  at its top what waits; a run's panel puts it first; a task shown whole
  is shown in a dialog.

## Impact

- `packages/webui`: `ModalLayer.tsx`; `PipelineView.tsx` (the banner, the
  forms in the layer); `AiPanel.tsx` and `HarnessChainPanel.tsx`
  (`WaitingForYou`); `RunLogsView.tsx`, `RunDialog.tsx`, `TaskPanel.tsx`,
  `CardActions.tsx`, `ChangeActionDialog.tsx` (`aria-modal`);
  `pipeline-entry.tsx`, `standalone-entry.tsx`; the styles.
