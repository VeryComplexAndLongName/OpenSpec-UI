## Why

`docs/adr/0001-shared-core-two-delivery-targets.md` defines that all
business logic (OpenSpec parsing, git integration, and CLI-agent
orchestration) must live in one package (`core`), while `server` and
`extension` must remain thin transport adapters. Without this, behavior drift
between the standalone tool and the VS Code extension is guaranteed over time
as functionality grows — exactly the risk raised in the external architecture
review (see ADR, "Rejected Alternatives"). This is the first change:
`shared-ui`, `standalone-app`, and `vscode-extension` all depend on the
command/event protocol defined here.

## What Changes

- Define a unified execution protocol: commands (`plan`, `implement`,
  `review`, `status`, `cancel`) and an event stream (`started`, `stdout`,
  `stderr`, `progress`, `completed`, `failed`, `cancelled`) independent of
  which CLI agent runs and which transport delivers results to consumers.
- Add `AgentRunner` as the execution abstraction with adapters for Claude CLI,
  GitHub Copilot CLI, Codex CLI, Gemini CLI, and a local LLM via an
  OpenAI-compatible API (SGLang/vLLM).
- Add a mandatory security model (not optional): per-agent command/argument
  allowlist, strict cwd sandbox, audit log for every run, and an explicit
  rule that repository file contents (`proposal.md`/`design.md`/issue text)
  are context data for the agent and never execution-engine instructions.
- Add a derived state machine for change status
  (`draft`/`in-progress`/`implemented`/`archived`) computed heuristically from
  location (`changes/` vs `changes/archive/`) and `[x]` ratio in `tasks.md`.
- Add thin wrappers over `openspec` CLI (`--json` commands) and `git` (via
  `simple-git` or equivalent), both without direct file-level logic in
  `server`/`extension`.

## Capabilities

### New Capabilities
- `execution-core`: single source of truth for behavior — execution protocol,
  security model, OpenSpec/git wrappers, and derived change state.

### Modified Capabilities
(none — first entry)

## Impact

New code: all of `packages/core/`. It must not depend on HTTP frameworks or
VS Code APIs and must remain unit-testable in isolation (Vitest, no server or
VS Code host required).

Development-phase validation note: only Claude CLI and GitHub Copilot CLI are
currently available for live smoke testing. Codex CLI, Gemini CLI, and local
LLM adapters are verified through mocks/contract tests until live access is
available.