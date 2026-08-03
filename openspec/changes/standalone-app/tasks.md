## 1. Server

- [x] 1.1 REST endpoints for one-shot commands (`status`).
- [x] 1.2 WebSocket channel for event-driven commands
      (`plan`/`implement`/`review`/`cancel`).
- [x] 1.3 Default bind on `127.0.0.1`; configurable port.
- [x] 1.4 Contract test: `server` correctly serializes/deserializes each
      `Event` variant from `execution-core` protocol.

## 2. Browser Shell

- [x] 2.1 `webui` entry point with `FetchTransport`, served by `server`.
- [x] 2.2 Diff renderer for standalone context only (see `shared-ui` design).

## 3. Validation

- [x] 3.1 Live smoke test: start `server`, open standalone in browser,
      execute a real `plan` command with a real CLI agent, and observe event
      stream.
- [x] 3.2 Document current live-agent coverage in the smoke-test notes:
      only Claude CLI and GitHub Copilot CLI are available for live testing in
      this development phase; other adapters are validated through
      mocks/contract tests.

## 4. Standalone UX and Workspace Flexibility Follow-up

- [x] 4.1 Add server startup opt-in for external `cwd` usage outside the
      startup workspace root (for users who intentionally work across
      repositories/folders).
- [x] 4.2 Update standalone launch docs with the new external-`cwd` flag and
      the related security implication.
- [x] 4.3 In standalone browser shell, auto-update `Change directory` when
      `Workspace root (cwd)` changes by appending `openspec/changes`.
- [x] 4.4 Add a non-trivial standalone visual theme (layout, typography,
      spacing, controls, event log readability) without changing the
      transport/protocol behavior.