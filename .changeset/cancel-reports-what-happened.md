---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

Report cancellation when it happens, not when it is requested.

- New non-terminal `cancelling` event. `cancelled` is now emitted only once the agent's process has actually exited; a process that outlives the request produces a `failed` naming that, not a `cancelled` that did not happen.
- `terminateProcessTree` reports whether the kill could be issued instead of swallowing the result, and treats POSIX `ESRCH` as success.
- The Cancel control stays available while a run is still producing output after a cancellation, and accepts a second press.
