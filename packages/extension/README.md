# openspec-ui-vscode

VS Code расширение. Основной режим — прямой импорт `@openspec-ui/core` в
extension host + message bridge к Webview (без сети). Опциональный режим —
локальный `@openspec-ui/server` как дочерний процесс, включается настройкой.
Списки (Changes/Archive/Specs) — через `TreeDataProvider`, редактирование
markdown и diff — делегируются нативному VS Code UI. См.
`openspec/changes/vscode-extension/design.md` за полным обоснованием и
`docs/adr/0001-*.md` за тем, почему это не "сервер всегда".

Реализуется по `openspec/changes/vscode-extension/tasks.md`. Ничего не
реализовано — подготовлена только структура и `contributes.commands` в
`package.json`.
