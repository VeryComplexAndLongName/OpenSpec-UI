---
"@openspec-ui/core": minor
---

A `"cancel"` command now stops the run it names instead of starting a second, billable agent process to ask the first one to stop. `spawnAndStream` accepts an optional `AbortSignal`; on abort it terminates the spawned process **tree** (via `taskkill /T /F /PID` on Windows, so a `.cmd`-shimmed agent like `copilot` is not orphaned) and ends the stream with `cancelled` rather than letting the killed process's non-zero exit surface as `failed`. `AgentAdapter.execute()` now receives that signal and every adapter (`claude`, `copilot`, `codex`, `gemini`, `local-llm`) forwards it. `createAgentRunner`'s returned runner tracks each run's `AbortController` by `runId` and handles a `"cancel"` command itself — aborting the matching run without calling `buildInvocation()`, calling `execute()`, or recording a run start; cancelling an already-finished or unknown `runId` is reported as `cancelled`, not an error.
