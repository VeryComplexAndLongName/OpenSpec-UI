# A delegated run says what happened

## Why

On 2026-09-13 `what-the-others-are-doing` 7.5 and
`a-status-write-never-stops-a-run` 5.4 were handed to `claude-cli`
through the product's own delegated-item route. The route failed three
times before anything useful ran, and each time it said less than it
knew.

- **The item named no agent.** Its marker read
  ``**Delegated to `claude-cli`**`` — the form every delegated item in
  this repository had used — and the reader accepts only a bare registry
  id. The inbox offered no run and the route refused with "names no
  agent". Every earlier delegated item had been closed by hand, so none
  had gone through the reader.
- **A failed run said only its exit code.** The installed `claude` was
  too old for the API, said exactly that on stderr, and exited 1. The
  result said "claude exited with code 1"; the owner found the reason by
  running `claude -p` by hand. The run's events carried the stderr, but
  `runDelegatedItem` keeps only the reason on the `failed` event, and
  neither host passes `onEvent`.
- **A delegated run was invisible to everything that shows runs.**
  `openspec-ui-cli status` said "No runs are reporting themselves" for
  the fifteen minutes a delegated agent worked, and so did the Pipeline
  tab. Every other run is wrapped in `withAgentStatus`;
  `runDelegatedItem` is not.

## What Changes

- **A marker names its agent however the id is quoted.**
  ``**Delegated to `claude-cli`**`` names `claude-cli`, exactly as the
  bare form does. A backtick on one side only still names nothing.
- **A failed delegated run says what the agent last said.** Its result
  keeps the last lines the agent wrote to stderr, bounded, and its
  message quotes the last of them.
- **A delegated run keeps a status record like any other run.**
  `runDelegatedItem` wraps the run in `withAgentStatus`, so
  `openspec-ui-cli status`, the survey and the Pipeline tab see it.

## Impact

- `packages/core` only: `task-checklist.ts` (the marker) and
  `delegated-item-run.ts` (the stderr tail and the status record). Both
  hosts — the standalone server and the VS Code extension — call
  `runDelegatedItem` and already show the result's `message`, so both get
  all three with no code of their own.
- No change to the gate, the audit log, the allowlist or the prompt.

## Out of scope

- Streaming a delegated run's output live to the surface that started
  it. The status record says what it is doing now; a live log belongs to
  the Pipeline work agreed for later.
- Rewriting markers in archived changes: only open items are listed.
