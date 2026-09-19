---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
"openspec-ui-vscode": minor
---

A run can be told where to stop, not only that it should

Asked for by the owner: say to a live run "only up to 4.6" without
interrupting it.

A request to stop can now name a task of the change. The run holds it and
goes on working; when that task is ticked, or its agent says it is
starting a task after it, the request becomes the stop the run already
knew how to honour, and it ends where the work is sound. Nothing pauses,
so nothing holds a lease while doing nothing.

It travels on the same signed channel as a plain stop, with the same
roster check and the same freshness window, and the chain's ending entry
names the task it was told to stop after beside the reason and the asker.

A request naming a task the change's list does not have is refused and
recorded, and the run goes on: a typo must not become "stop now". One
naming a task already ticked stops the run at the next sound point and
says the point had passed.

From a terminal: `openspec-ui-cli stop <instanceId> --reason "..." --after
4.6`. From the editor: "OpenSpec UI: Stop This Run After a Task" on a
change's row, which asks for the task and the reason.
