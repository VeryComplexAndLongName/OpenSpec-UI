## Why

`docs/adr/0001-shared-core-two-delivery-targets.md` требует standalone-формы
поставки для пользователей без VS Code. Зависит от `execution-core`
(протокол/логика) и `shared-ui` (представления) — этот change добавляет
только доставку: тонкий REST/WS сервер и браузерную оболочку.

## What Changes

- Добавляется `packages/server` — тонкий REST/WS слой, реализующий
  `Transport`-совместимый API поверх `execution-core`. Не содержит
  бизнес-логики — только (де)сериализацию протокола команд/событий под
  HTTP/WebSocket.
- Добавляется браузерная точка входа для `packages/webui` с
  `FetchTransport`, обслуживаемая тем же `server`.
- Добавляется собственный diff-рендер в `webui` для этого контекста (см.
  `shared-ui`'s design.md — используется только там, где нет нативного
  хоста с diff-editor).

## Capabilities

### New Capabilities
- `standalone-app`: standalone web-инструмент — `server` + браузерная
  сборка `webui`.

### Modified Capabilities
(нет)

## Impact

Новый код: `packages/server/`, точка входа для standalone-сборки в
`packages/webui` (или отдельный `packages/standalone`, если сборка
браузерной точки входа требует своей конфигурации — решить при apply, не
блокирует этот proposal).
