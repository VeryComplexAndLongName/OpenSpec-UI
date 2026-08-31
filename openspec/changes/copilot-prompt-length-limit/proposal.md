## Why

Direct follow-up to `agent-prompt-context`, found live immediately after
that fix shipped: re-running "Run with Agentic Harness" → `implement`
(`copilot-cli`) for `changeset-version-automation` now failed outright
with `copilot exited with code 1`, before doing any work at all
(`Steps: 0`). Reproduced directly (`cross-spawn`, the exact invocation
`CopilotCliAdapter` uses, with a real ~9.5KB prompt built from that
change's actual `proposal.md`/`design.md`/`tasks.md`): `copilot` exits
immediately with an OS-level stderr message (the terminal shows
replacement characters because the raw bytes are CP866, the Windows
console codepage for this machine's locale, not UTF-8) that decodes to
the Russian-language OS text for **"The command line is too long."**

Root cause: `CopilotCliAdapter` is the only adapter that passes the full
prompt as a positional CLI argument instead of via stdin (`copilot -p`
does not read from stdin at all — confirmed by the comment already in
`copilot.ts`, from an earlier live smoke test). Before
`agent-prompt-context`, the prompt was almost empty, so this never
mattered. Now that it embeds real file content, any change whose combined
`proposal.md`/`design.md`/`tasks.md`/delta-spec content is large enough
pushes the full command line (`cmd.exe /d /s /c copilot -p "<prompt>"
--allow-all-tools` — cross-spawn resolves `copilot`'s npm-global `.cmd`
shim through `cmd.exe`, whose own command-line length limit is ~8191
characters, well under `CreateProcess`'s ~32767-character ceiling) past
that limit, and `copilot` never even starts.

## What Changes

- `packages/core/src/agents/copilot.ts`: if the constructed prompt would
  push the command line past a conservative safety margin under the
  `cmd.exe` limit, `CopilotCliAdapter` sends a short, explicit "read the
  actual files yourself" prompt instead of the full embedded content —
  naming the exact `changeDir` and the artifact files to read, with the
  same "work only within this directory" constraint
  `agent-prompt-context` added. Below the threshold, the full embedded
  prompt is used unchanged, exactly as today. `copilot-cli` already runs
  with `--allow-all-tools`, so it has its own file-reading tools
  available either way — this only changes whether content is pushed to
  it inline or it is told to pull the content itself.
- No change to `claude-cli`/`codex-cli`/`gemini-cli` — all three already
  pass the prompt via stdin, which has no comparable length limit; this
  is specific to `copilot-cli`'s own CLI constraint.
- Noted, not fixed here (see design.md, "Also found, not in scope"): the
  allowlist's `copilot-cli` rule (`exact(["-p", "--allow-all-tools"])`,
  checked against `buildInvocation()`'s static 2-argument shape) does not
  match the actual 3-argument shape `execute()` spawns (`-p`, `<prompt>`,
  `--allow-all-tools`) — not exploitable (the inserted argument is always
  prompt text, a single positional argument that cannot be reinterpreted
  as a different flag), but a real consistency gap between what the
  allowlist documents and what actually runs.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core`: `copilot-cli`'s adapter degrades gracefully instead
  of failing outright when a change's context is too large for its
  argv-only prompt delivery.

## Impact

- `packages/core/src/agents/copilot.ts`, `copilot.test.ts`.
- No `server`/`extension`/`webui` changes.
