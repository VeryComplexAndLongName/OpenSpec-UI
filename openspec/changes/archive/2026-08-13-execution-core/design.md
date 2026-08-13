## Context

See proposal.md (Why) and
`docs/adr/0001-shared-core-two-delivery-targets.md` for the full
architecture context. `core` is a Node package with no runtime dependency on
Express/Fastify/`vscode` — it is imported directly by `extension` and wrapped
by a thin REST/WS layer in `server`.

## Goals / Non-Goals

**Goals:**
- One command/event protocol that both `server` and `extension` can adapt
  without reimplementing execution logic.
- A security model strong enough for real CLI-agent runs on real user
  repositories without prompt injection via change-file contents and without
  arbitrary cwd escape.
- A derived change state machine that does not require modifying the OpenSpec
  format.

**Non-Goals:**
- Does not implement the REST/WS server (`standalone-app`) or Webview/message
  bridge adapter (`vscode-extension`) — only the protocol they serialize.
- Does not define UI behavior (how to visualize progress) — only the event
  stream that UI must render.
- Does not solve authentication for third-party CLI agents
  (Claude/Copilot/etc.) — assumes agents are already authenticated in the
  execution environment.

## Decisions

- **Protocol = commands + event stream, not request/response**: `plan`,
  `implement`, and `review` may run for minutes. A single event-driven
  protocol is simpler than split API styles.
  - Rejected alternative: synchronous REST for `status` and streaming only for
    long commands. Rejected as an unnecessary contract split.
- **`AgentRunner` interface with `run(command, cwd, context) ->
  AsyncIterable<Event>` and per-agent adapters**: differences between
  Claude/Copilot/Codex/Gemini/local LLM are encapsulated in adapters, while
  output remains one protocol.
- **Security model is inline in `AgentRunner.run()`, not optional middleware**:
  allowlist and cwd checks happen before spawn; audit logging runs regardless
  of outcome.
  - Rejected alternative: security behind an optional config flag. Rejected to
    keep secure-by-default behavior.
- **Derived state is a pure function `deriveChangeState(changeDir):
  ChangeState` with no side effects**, reused as a single implementation.

## Risks / Trade-offs

- [Risk] CLI output formats may change across versions and break strict parser
  logic.
  Mitigation: conservative parsing; unknown output is passed through as
  `stdout` instead of failing the run.
- [Risk] Allowlist defaults may be too restrictive for some workflows.
  Mitigation: allowlist is workspace-configurable, with restrictive defaults.
- [Risk] Derived state is heuristic and may not match user intuition in all
  cases.
  Mitigation: document the heuristic explicitly and avoid claiming stronger
  semantics than available data supports.
- [Constraint] During development, only Claude CLI and GitHub Copilot CLI are
  available for live smoke tests.
  Mitigation: Codex/Gemini/local-LLM adapters are validated through
  deterministic mock/contract tests until live access is available.