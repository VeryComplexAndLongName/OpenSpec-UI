## 1. Основной режим (прямой import + message bridge)

- [ ] 1.1 Extension host импортирует `execution-core` напрямую
- [ ] 1.2 `MessageBridgeTransport` реализация на стороне extension (парная
      к той, что в `shared-ui`)
- [ ] 1.3 Webview-панель для AI-панели (из `shared-ui`), подключённая через
      message bridge
- [ ] 1.4 Тест: команда, запущенная через message bridge, даёт тот же
      результат, что через `FetchTransport` в `standalone-app` (используя
      contract test из `shared-ui`)

## 2. Нативный VS Code UI

- [ ] 2.1 `TreeDataProvider` для Changes (статус — из derived state
      `execution-core`)
- [ ] 2.2 `TreeDataProvider` для Archive
- [ ] 2.3 `TreeDataProvider` для Specs
- [ ] 2.4 Открытие spec/proposal в нативном редакторе VS Code (не в
      Webview) при запросе редактирования
- [ ] 2.5 Diff между версиями change через `vscode.diff`
- [ ] 2.6 Commands, зарегистрированные в Command Palette
      (`openspec-ui.plan`, `.implement`, `.review`, `.status`, `.cancel`)
- [ ] 2.7 Настройки через `contributes.configuration` (выбор агента по
      умолчанию, включение опционального режима локального сервера)

## 3. Опциональный режим локального сервера

- [ ] 3.1 Спавн `packages/server` как дочернего процесса с динамическим
      портом при включении настройки
- [ ] 3.2 Handshake extension → Webview с фактическим портом
- [ ] 3.3 Cleanup дочернего процесса при закрытии окна/выключении настройки
- [ ] 3.4 Тест: два одновременно открытых окна VS Code с включённым режимом
      не конфликтуют по портам

## 4. Проверка

- [ ] 4.1 Живой smoke-тест в обоих режимах (основной, опциональный
      локальный сервер) — реальный запуск через реальный CLI-агент
