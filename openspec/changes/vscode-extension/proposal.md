## Why

`docs/adr/0001-shared-core-two-delivery-targets.md` — вторая форма поставки,
по прямому требованию заказчика. Максимизирует использование нативного
VS Code API вместо переизобретения UI (diff-editor, TreeDataProvider,
встроенный Git extension API, Tasks/Terminal API,
`contributes.configuration`, опционально Chat Participant API) — решение,
принятое явно, чтобы не конкурировать с уже зрелыми инструментами внутри
самого VS Code.

## What Changes

- Добавляется `packages/extension` — регистрирует Commands (Command
  Palette), `TreeDataProvider` для Changes/Archive/Specs, Webview-панель
  только для того, что не покрывается нативными views (список changes с
  кастомной фильтрацией, AI-панель).
- Прямой импорт `execution-core` в extension host — `MessageBridgeTransport`
  как основной путь получения данных Webview'ом (см. `docs/adr/0001-*.md`,
  "Отклонённые альтернативы" — пересмотрено по итогам рецензии).
- Опциональный режим: extension поднимает `packages/server` как дочерний
  процесс, Webview указывает на `http://127.0.0.1:<port>` — только если
  явно включено пользователем (полная идентичность UX со standalone важнее
  отсутствия lifecycle-сложности порта).
- Делегирование markdown-редактирования и diff нативным возможностям VS
  Code (см. `shared-ui`'s design.md).

## Capabilities

### New Capabilities
- `vscode-extension`: VS Code расширение с прямым доступом к
  `execution-core`, нативным UI где возможно, Webview — где нет.

### Modified Capabilities
(нет)

## Impact

Новый код: `packages/extension/`. Зависит от `execution-core` (прямой
import) и `shared-ui` (Webview-контент). Опционально — от `standalone-app`'s
`packages/server`, если включён режим локального сервера.
