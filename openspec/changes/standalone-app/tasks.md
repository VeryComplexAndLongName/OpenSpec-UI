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