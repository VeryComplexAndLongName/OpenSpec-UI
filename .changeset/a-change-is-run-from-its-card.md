---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

A change is run from its Pipeline card.

- Start opens the run dialog for that change. In the standalone app, the dialog and the chain it starts are shown on the Pipeline tab, with focus moved into them and back to Start when they close. In the editor, the Pipeline panel runs `openspec-ui.runWithHarness`, which now accepts a change name and refuses one that is not an active change.
- On a run this host holds, the card answers a checkpoint (`Continue to <stage>`), a permission (`Allow`, `Deny`), and offers `Stop`, which asks for a reason, and `Stop now` once a stop has been asked. A run held elsewhere offers only its folder path to copy, and a waiting run says it is answered where it was started.
- A new `stop` command asks a run to stop where its work is sound: at a checkpoint at once, on a permission by denying it, and inside a stage at the next task marker naming another task or the next ticked task. Both `HarnessChainRunner` and the agent runner use one rule, in `stop-boundary.ts`. A `stopRequested` event says the stop was asked, the status record states it, and the chain's ending audit entry carries `stopRequest` with the reason and who asked.
- Each host keeps a `LiveRuns` registry of the runs it holds. The server answers `/api/live-runs`, and the editor's Pipeline panel answers `pipeline/live-runs`.
- A run waiting here that this host does not hold reads `Waiting in <label>`, as ADR 0029 words it.
- Cancelling a chain from the Processes tree now cancels the chain. The chain's event log in `HarnessChainPanel` is reachable by keyboard.
