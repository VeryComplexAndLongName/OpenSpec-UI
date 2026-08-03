# @openspec-ui/webui

Транспорт-агностичные React-компоненты (Changes/Archive/Specs/Tasks/AI-
панель) — переиспользуются и в standalone (браузер), и в VS Code extension
(Webview). Взаимодействие с `@openspec-ui/core` только через интерфейс
`Transport` (`FetchTransport`/`MessageBridgeTransport`) — см.
`openspec/changes/shared-ui/design.md`.

Markdown-редактирование и diff делегируются хосту, где это возможно (не
реализуются здесь для VS Code-контекста) — см. тот же design.md,
"Decisions".

Реализуется по `openspec/changes/shared-ui/tasks.md`. Ничего не
реализовано — подготовлена только структура.
