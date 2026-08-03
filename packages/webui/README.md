# @openspec-ui/webui

Транспорт-агностичные React-компоненты (Changes/Archive/Specs/Tasks/AI-
панель) — переиспользуются и в standalone (браузер), и в VS Code extension
(Webview). Взаимодействие с `@openspec-ui/core` только через интерфейс
`Transport` (`FetchTransport`/`MessageBridgeTransport`) — см.
`openspec/changes/shared-ui/design.md`.

Markdown-редактирование и diff делегируются хосту, где это возможно (не
реализуются здесь для VS Code-контекста) — см. тот же design.md,
"Decisions".

Реализовано по `openspec/changes/shared-ui/tasks.md`.

## Модули

- `transport/` — `Transport` интерфейс, `FetchTransport`, `MessageBridgeTransport`
  (VS Code `postMessage`). `transport/contract.test.ts` проверяет, что оба дают
  одинаковый поток событий для одного сценария.
  `FetchTransport`'s проводной протокол (v0.2.0+, согласован с
  `openspec/changes/standalone-app/design.md`): `status` — REST
  (`POST /api/status`, синхронный ответ со списком событий; команда быстрая,
  WS ради нее избыточен), `plan`/`implement`/`review`/`cancel` — одно
  WebSocket-соединение (`/api/ws`) на команду и её события. `FetchTransportOptions`
  теперь принимает `webSocketCtor` вместо `eventSourceCtor` (breaking для кода
  вне этого репозитория — на момент этого изменения таких потребителей не было).
- `components/ChangesList`, `ArchiveList`, `ChangeDiff`, `ChangeRelations` —
  Changes/Archive. Статус берётся из уже вычисленного `ChangeSummary.state`
  (`@openspec-ui/core`'s derived state), компоненты его не пересчитывают.
- `components/SpecsTree`, `RequirementView`, `SpecsSearch` — Specs. Рендер
  read-only (`markdown.ts` — минимальный inline-рендер `**bold**`/`` `code` ``,
  не полноценный markdown). Редактирование делегируется хосту.
- `components/TasksChecklist` — чек-лист + прогресс; запуск отдельной задачи
  — через callback `onRunTask`, хост подключает его к активному `Transport`.
- `components/AgentPicker`, `AiPanel` — единственные компоненты, которым
  `Transport` нужен напрямую (send/subscribe команд `plan`/`implement`/
  `review`/`cancel` и поток событий). Список агентов — `AGENT_REGISTRY` из
  `@openspec-ui/core`, не собственный список.

## Презентационная граница

Компоненты Changes/Archive/Specs/Tasks — презентационные: принимают уже
полученные данные через props (кто и как их получает — REST в standalone,
прямой импорт `@openspec-ui/core` в extension — решает хост, не `webui`).
Единственное исключение — `AiPanel`, которому нужен `Transport` напрямую,
поскольку исполнение команды неотделимо от потока её событий.

## Протокол: выбор агента

`Command.agentId` (опциональное поле, добавлено в `@openspec-ui/core@0.3.0`)
— то, как `AiPanel` сообщает хосту, какой зарегистрированный `AgentAdapter`
должен выполнить команду. Без этого поля выбор агента в UI не имел бы
эффекта на фактическое исполнение.
