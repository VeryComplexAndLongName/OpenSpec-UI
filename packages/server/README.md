# @openspec-ui/server

Тонкий REST/WS слой над `@openspec-ui/core` — не содержит бизнес-логики,
только сериализация протокола команд/событий под HTTP/WebSocket и отдача
браузерного шелла `@openspec-ui/webui`. Bind по умолчанию на `127.0.0.1`.

Используется standalone-инструментом (`openspec/changes/standalone-app/`)
и опционально VS Code extension'ом (`openspec/changes/vscode-extension/`,
режим локального сервера).

Реализовано по `openspec/changes/standalone-app/tasks.md`. Живой smoke-тест
и найденные баги — `openspec/changes/standalone-app/smoke-test-notes.md`.

## Проводной протокол

- `POST /api/status` — REST, синхронный ответ `{ events: Event[] }` (команда
  `status` обычно быстрая, WS ради неё избыточен).
- `GET /api/ws` (WebSocket) — команда отправляется и её события приходят по
  одному и тому же соединению; используется для `plan`/`implement`/
  `review`/`cancel`.
- `GET /` и `GET /app.js` — браузерный шелл (`packages/webui/src/standalone-entry.tsx`,
  собранный `scripts/build-client.mjs` в `dist/app.js`).

Ни одна из этих ручек не содержит логики исполнения агента, allowlist/cwd-
проверок или вычисления статуса change'а — всё это делегируется
`@openspec-ui/core` (`buildDefaultAgentRunners`/`buildDefaultAllowlist` —
готовая сборка реестра `AgentRunner`, переиспользуемая и `server`, и
`extension`, не изобретаемая заново в каждом хосте).

## Запуск

```bash
npm run build   # собирает браузерный бандл в dist/app.js
npm run start -- <workspaceRoot> <port>   # по умолчанию: cwd процесса, порт 4317
```

Optional (explicit opt-in): allow commands to use `cwd` outside startup
`workspaceRoot`.

```bash
npm run start -- <workspaceRoot> <port> --allow-external-cwd
```

Use this only when you intentionally work across multiple folders/repositories.

Open the authenticated URL printed by the server. Its fragment contains an
ephemeral token, for example
`http://127.0.0.1:<port>/#token=<ephemeral-token>`. REST clients must send the
token in `X-OpenSpec-UI-Token`; WebSocket clients must send it through the
`openspec-ui-token.<token>` subprotocol.
