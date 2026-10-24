## Context

See ADR 0051 for the sandbox decision and the trial runs it rests on.

## Decisions

- **Sandbox by command kind** (`codexSandboxFor`): `workspace-write` for
  `plan`, `implement`, `update`, `verify`; `read-only` otherwise. Verify
  writes: its checks build and write caches, and it ticks tasks.
- **The allowlist requires the sandbox** as the fourth argument and admits
  only the two modes; `--model` is admitted by `MODEL_ID_PATTERN`, as for
  the other agents; `-c` still admits only the effort key.
- **The stream is read line by line**, across chunk boundaries. Agent
  messages, `$ command` lines, `(exit N)` with the last ten lines of a
  failed command's output, and `changed <paths>` become `stdout` text, so
  a run log, the task markers (`Starting task 2.3`) and the review verdict
  read as before. A line that is not JSON is passed through.
- **Usage**: codex's `input_tokens` include cached input; `inputTokens` is
  the rest, `cacheReadInputTokens` the cached part, reasoning tokens as
  `thoughtTokens`. Absent fields stay absent - never a zero.
- **A failed turn** (`turn.failed`, or an `error` event) is said on
  `stderr`, and the run's `completed` becomes `failed` with
  `OSW-AGT-222`.

## Risks / Trade-offs

- A future `codex` that renames its events → the stream degrades to
  passing lines through; the run still ends by the exit code.
- Output of commands the agent runs may come in the console's OEM code page
  (seen in the trial) → only a failed command's tail is shown, as it came.
