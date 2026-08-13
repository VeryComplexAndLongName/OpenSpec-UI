## 1. Transport

- [x] 1.1 `Transport` interface (`send`/`subscribe`).
- [x] 1.2 `FetchTransport` (REST + WebSocket/EventSource).
- [x] 1.3 `MessageBridgeTransport` (VS Code `postMessage`).
- [x] 1.4 Contract test: one scenario (success/error/disconnect) yields an
      equivalent event set through both transport implementations.

## 2. Changes / Archive

- [x] 2.1 Changes list — status from `execution-core` derived state.
- [x] 2.2 Diff between archived change versions (only in context where host
      native diff is unavailable, see design.md).
- [x] 2.3 Archive: search, filters, history.
- [x] 2.4 Display links between changes (dependencies from proposal.md when
      explicitly annotated).

## 3. Specs

- [x] 3.1 Tree view for specs.
- [x] 3.2 Read-only markdown rendering for requirement/scenario.
- [x] 3.3 Specs search.
- [x] 3.4 Requirement links (navigate by capability references).

## 4. Tasks

- [x] 4.1 Checklist + progress (`[x]` ratio).
- [x] 4.2 Run a single task via `implement`, scoped to specific task item,
      through active `Transport`.

## 5. AI Panel

- [x] 5.1 Agent picker (list from registered `AgentRunner` adapters in
      `execution-core`).
- [x] 5.2 Unified launch UI for `plan`/`implement`/`review`, independent of
      selected agent and active `Transport`.
- [x] 5.3 Event-stream rendering
      (`started`/`stdout`/`stderr`/`progress`/`completed`/`failed`/
      `cancelled`) with cancel (`cancel`) support.