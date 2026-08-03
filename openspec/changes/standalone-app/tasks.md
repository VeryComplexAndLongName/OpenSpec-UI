## 1. Server

- [ ] 1.1 REST endpoints for one-shot commands (`status`).
- [ ] 1.2 WebSocket channel for event-driven commands
      (`plan`/`implement`/`review`/`cancel`).
- [ ] 1.3 Default bind on `127.0.0.1`; configurable port.
- [ ] 1.4 Contract test: `server` correctly serializes/deserializes each
      `Event` variant from `execution-core` protocol.

## 2. Browser Shell

- [ ] 2.1 `webui` entry point with `FetchTransport`, served by `server`.
- [ ] 2.2 Diff renderer for standalone context only (see `shared-ui` design).

## 3. Validation

- [ ] 3.1 Live smoke test: start `server`, open standalone in browser,
      execute a real `plan` command with a real CLI agent, and observe event
      stream.
- [ ] 3.2 Document current live-agent coverage in the smoke-test notes:
      only Claude CLI and GitHub Copilot CLI are available for live testing in
      this development phase; other adapters are validated through
      mocks/contract tests.