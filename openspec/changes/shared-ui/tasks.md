## 1. Transport

- [x] 1.1 Интерфейс `Transport` (`send`/`subscribe`)
- [x] 1.2 `FetchTransport` (REST + WebSocket/EventSource)
- [x] 1.3 `MessageBridgeTransport` (VS Code `postMessage`)
- [x] 1.4 Contract test: один и тот же сценарий (успех/ошибка/обрыв
      соединения) даёт одинаковый набор событий через оба `Transport`

## 2. Changes / Archive

- [x] 2.1 Список Changes — статус из `execution-core`'s derived state
- [x] 2.2 Diff между версиями архивного change (только в контексте, где
      нативный diff хоста недоступен — см. design.md)
- [x] 2.3 Archive: поиск, фильтры, история
- [x] 2.4 Отображение связей между changes (зависимости из proposal.md,
      если размечены)

## 3. Specs

- [x] 3.1 Древовидное отображение specs
- [x] 3.2 Read-only markdown-рендер требования/сценария
- [x] 3.3 Поиск по specs
- [x] 3.4 Ссылки между требованиями (переход по упоминанию capability)

## 4. Tasks

- [x] 4.1 Чек-лист + прогресс (доля `[x]`)
- [x] 4.2 Запуск отдельной задачи — команда `implement`, скоуп на пункт
      задачи, через активный `Transport`

## 5. AI-панель

- [x] 5.1 Выбор агента (список из `execution-core`'s зарегистрированных
      `AgentRunner`-адаптеров)
- [x] 5.2 Единый интерфейс запуска `plan`/`implement`/`review` независимо
      от выбранного агента и активного `Transport`
- [x] 5.3 Отображение потока событий (started/stdout/stderr/progress/
      completed/failed/cancelled) с возможностью отмены (`cancel`)
