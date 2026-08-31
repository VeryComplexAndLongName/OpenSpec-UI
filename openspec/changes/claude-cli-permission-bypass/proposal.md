## Why

Live failure, confirmed root cause (unlike the earlier, retracted
`copilot-cli-path-permission` investigation, which could not be
conclusively linked to its incident): a real "Run with Agentic Harness"
→ `implement` (`claude-cli`) for `tree-command-selection-feedback`
reported `Result: completed`, `Steps: 0`, with the agent's own message
verbatim: "I'm blocked waiting on file-edit permission for
`packages/extension/src/commands.ts`. Please approve the Edit tool (or
switch to a permission mode that allows it) so I can proceed with
implementing the tasks." — an unambiguous, self-diagnosing statement from
Claude Code itself, not an inferred symptom.

Root cause, read directly from `packages/core/src/agents/claude.ts`:
`buildInvocation()` returns `args: ["-p", "--output-format", "text"]` —
no permission-bypass flag at all. `claude -p` (non-interactive print
mode) still enforces its normal interactive tool-approval model by
default; with no TTY to answer an approval prompt, any tool needing
approval (here, `Edit`) has no way to proceed and the run reports
`completed` with zero actual steps taken — a misleading "looks green,
did nothing" result, the same failure shape flagged as a real, un-fixed
gap in `docs/adr/0012`'s terminal-event contract during the
`copilot-cli-path-permission` investigation.

This is `claude-cli`'s own version of a gap `copilot-cli`/`gemini-cli`
already close: `copilot.ts` already passes `--allow-all-tools`, and
`default-runners.ts`'s allowlist for `gemini-cli` already uses `--yolo`
(gemini's own full-bypass flag) — `claude-cli` is the one adapter with no
non-interactive tool-approval bypass whatsoever.

## What Changes

- `packages/core/src/agents/claude.ts`: `buildInvocation()` adds
  `--dangerously-skip-permissions` to its static args.
- `packages/core/src/default-runners.ts`: `claude-cli`'s allowlist
  `exact([...])` entry updated to match.
- No change to `copilot-cli`/`codex-cli`/`gemini-cli`/`local-llm`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core`: `claude-cli` can actually perform file edits in a
  real, non-interactive run instead of every edit blocking on an
  unanswerable approval prompt.

## Impact

- `packages/core/src/agents/claude.ts`, `claude.test.ts`,
  `default-runners.ts`, `default-runners.test.ts` (if it asserts the
  allowlist shape for `claude-cli`).
- No `server`/`extension`/`webui` changes.
