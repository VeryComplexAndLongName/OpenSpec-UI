---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

A run can be asked for at a time, and says what became of it.

The run dialog now takes a time as well as a path — the same question,
asked once. The schedule lives in `.openspec-ui/scheduled-runs.json`,
gitignored beside the audit log, because "start this one at six" is one
person's intent on one machine rather than project configuration.

`one-way-in-to-run` left this open with the argument it turns on: what
happens when the process is not running. The answer here is that the run
starts the next time the application is opened, and the dialog says how
late it is — a schedule that quietly does not happen is worse than no
schedule, so the dialog also says, before anyone relies on it, that it
needs the application open.

A time already past is refused where it is entered. Where several come
due together one starts and the rest are reported as waiting, because the
workspace lease refuses a second mutating run and that refusal would read
as a fault. An entry for a change that no longer exists is dropped and the
drop is reported.

Both hosts fire from the same core function, on start and on a tick.
