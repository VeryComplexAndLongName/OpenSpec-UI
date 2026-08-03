## Why

`docs/adr/0001-shared-core-two-delivery-targets.md` требует одного набора
UI-компонентов для Changes/Archive/Specs/Tasks/AI-панели, работающего
одинаково в браузере (standalone) и в Webview (VS Code extension) — без
дублирования вёрстки/логики отображения между двумя формами поставки.
Зависит от `execution-core` (протокол команд/событий, derived change-state)
— оттуда `webui` берёт данные, сам их не парсит.

## What Changes

- Добавляется интерфейс `Transport` с двумя реализациями:
  `FetchTransport` (REST/WS к `server`, для standalone и опционального
  режима extension) и `MessageBridgeTransport` (`postMessage`/
  `acquireVsCodeApi`, основной режим extension).
- Добавляются представления: список Changes (статус из `execution-core`'s
  derived state, diff между архивными версиями), Archive (поиск/фильтры/
  история), Specs (дерево, read-only markdown-рендер требований — не
  редактор, редактирование делегируется хосту: VS Code для extension,
  минимальный редактор+превью для standalone), Tasks (чек-лист, прогресс,
  запуск отдельной задачи через команду `implement`, скоуп на конкретный
  пункт), AI-панель (выбор агента, единая кнопка/форма для
  plan/implement/review, использующая протокол `execution-core` независимо
  от активного `Transport`).

## Capabilities

### New Capabilities
- `shared-ui`: транспорт-агностичные React-компоненты для Changes/Archive/
  Specs/Tasks/AI, переиспользуемые в standalone и в VS Code extension.

### Modified Capabilities
(нет)

## Impact

Новый код: `packages/webui/`. Зависит от типов протокола, экспортируемых
`packages/core` (`execution-core`) — не от `packages/server` напрямую (тот
лишь один из двух `Transport`).
