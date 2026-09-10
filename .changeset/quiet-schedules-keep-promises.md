---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": patch
"openspec-ui-vscode": minor
---

A scheduled run keeps the promise the dialog makes. Opening the
application is now enough: the workspace is read on open, so the
schedule is read too and a due run starts with nothing else done — it
used to wait for a click that a real reopen never makes. The run starts
on the path that was chosen when it was scheduled rather than reopening
the dialog for the same choice, and the entry leaves the file only once
the run has been opened, so a configuration that cannot be resolved
reports itself as a run that could not be opened instead of consuming
the schedule under the wrong message. A change archived after being
scheduled is dropped and says it was archived, and a run due behind it
starts on the same reading. Firing is decided once, in
`planScheduleFiring` in core, with each host performing only the
effects it is handed. The dialog is announced as a dialog and takes
focus when it opens by itself, and what the schedule did is readable
from any tab of the standalone shell.
