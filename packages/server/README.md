# @openspec-ui/server

A thin authenticated REST/WebSocket adapter over `@openspec-ui/core`. It serves
the standalone `@openspec-ui/webui` shell and binds to `127.0.0.1` by default.
Business logic, execution security, recovery, and change state remain in core.

The standalone capability is governed under `openspec/changes/standalone-app/`.
The VS Code extension may also launch this server as an optional transport mode.

## Transport

- `POST /api/status`: synchronous `{ events: Event[] }` response for status.
- `POST /api/command-json`: direct structured OpenSpec commands.
- `GET /api/ws`: bidirectional command/event streaming.
- `POST /api/change-editor/*`: conflict-aware Change Editor operations.
- `POST /api/processes/*`: persistent process review, rollback, and cleanup.
- `GET /` and `GET /app.js`: built standalone browser shell.

Every API request requires the ephemeral startup token. REST clients send
`X-OpenSpec-UI-Token`; WebSocket clients use the
`openspec-ui-token.<token>` subprotocol.

## Run

```bash
npm run build
npm run start -- <workspaceRoot> <port>
```

The default port is `4317`. To intentionally permit API requests outside the
startup workspace, use the explicit opt-in flag:

```bash
npm run start -- <workspaceRoot> <port> --allow-external-cwd
```

Open the tokenized URL printed by the server after startup.
