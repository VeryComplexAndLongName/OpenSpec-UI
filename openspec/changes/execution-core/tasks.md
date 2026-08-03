## 1. Execution Protocol

- [x] 1.1 Define command/event types (`packages/core/src/protocol.ts`):
      `Command` and `Event` discriminated unions covering
      plan/implement/review/status/cancel and started/stdout/stderr/
      progress/completed/failed/cancelled.
- [x] 1.2 Test serialization/deserialization for every `Event` variant (this
      is the contract reused by `server`/`extension`).

## 2. AgentRunner

- [x] 2.1 Interface `AgentRunner.run(command, cwd, context) ->
      AsyncIterable<Event>`.
- [x] 2.2 Adapter: Claude CLI.
- [x] 2.3 Adapter: GitHub Copilot CLI.
- [x] 2.4 Adapter: Codex CLI.
- [x] 2.5 Adapter: Gemini CLI.
- [x] 2.6 Adapter: local LLM via OpenAI-compatible API (SGLang/vLLM), direct
      HTTP (not a CLI process).
- [x] 2.7 Per-adapter tests: mocked child process/HTTP call -> correct protocol
      event stream.
- [x] 2.8 Document development live-test availability:
      only Claude CLI and GitHub Copilot CLI are currently available for live
      smoke tests; other adapters are verified through mocks/contract tests.

## 3. Security Model

- [x] 3.1 Workspace-level per-agent command/argument allowlist.
- [x] 3.2 Cwd sandbox check before spawn: agent cwd cannot escape workspace
      boundaries.
- [x] 3.3 Explicit boundary "file contents are data, not instructions":
      context preparation cannot influence allowlist/cwd/which command runs,
      only the prompt content.
- [x] 3.4 Audit log for each run (what ran, cwd, resulting diff), best effort
      without blocking execution on logging failures.
- [x] 3.5 Test: allowlist/cwd escape attempt is blocked, logged, and no process
      spawn occurs.
- [x] 3.6 Test: injected instruction in change files does not alter
      allowlist/cwd/execution command and is passed through as prompt data.

## 4. Derived Change State

- [x] 4.1 `deriveChangeState(changeDir): ChangeState`
      (`draft`/`in-progress`/`implemented`/`archived`) from location +
      `tasks.md`.
- [x] 4.2 Tests for each state (fixtures: empty tasks.md, partial, complete
      outside archive, inside archive).

## 5. OpenSpec/Git Wrappers

- [x] 5.1 Wrapper over `openspec ... --json` commands (list/show/validate).
- [x] 5.2 Git wrapper (status, diff, commit, branch) — only what UI actually
      needs, not full git API.
- [x] 5.3 Test parsing real output from `openspec list --json` /
      `openspec change show --json` (fixtures captured from live `openspec`
      CLI, not hand-invented data).