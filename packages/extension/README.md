# OpenSpec UI (VS Code)

VS Code расширение поверх `@openspec-ui/core`. Основной режим — прямой
импорт `core` в extension host + in-process message bridge к Webview (без
сети). Опциональный режим — локальный `@openspec-ui/server` как дочерний
процесс на динамическом порту, включается настройкой. Списки
(Changes/Archive/Specs) — через `TreeDataProvider`, редактирование markdown
и diff — делегируются нативному VS Code UI (`vscode.open`/`vscode.diff` +
встроенный Git extension). См. `openspec/changes/vscode-extension/design.md`
за полным обоснованием и `docs/adr/0001-*.md` за тем, почему это не "сервер
всегда".

Реализовано по `openspec/changes/vscode-extension/tasks.md`. Живой прогон
внутри реального VS Code (`@vscode/test-electron`) и найденные баги — см.
`openspec/changes/vscode-extension/TEST-NOTES.md`.

**Только для локального/внутреннего использования** — не публикуется в
публичный VS Code Marketplace (см. CHANGELOG.md).

## Команды

`Ctrl+Shift+P` → `OpenSpec UI: ...`:

- **Plan / Implement / Review / Status** — выбор change из списка, запуск
  через сконфигурированного агента (`openspec-ui.agent.defaultId`).
- **Cancel** — отменяет текущий активный запуск, если он есть.
- **Open AI Panel** — открывает Webview-панель с выбором агента/команды и
  потоком событий.
- **Refresh** — обновляет все три дерева (Changes/Archive/Specs).
- **Review Diff (tasks.md vs HEAD)** — из контекстного меню элемента дерева
  Changes/Archive: `vscode.diff` между рабочей версией `tasks.md` и `HEAD`.

## Настройки

- `openspec-ui.transport.localServer.enabled` (по умолчанию `false`) —
  опциональный локальный сервер вместо message bridge.
- `openspec-ui.agent.defaultId` (по умолчанию `claude-cli`) — какой
  зарегистрированный `AgentRunner`-адаптер использовать.
- `openspec-ui.agent.localLlm.baseUrl` / `.model` — только для
  `agent.defaultId: "local-llm"`.

## Сборка и локальная установка

```bash
npm run build              # extension.js + webview.js + standalone-ассеты
npx @vscode/vsce package   # openspec-ui-vscode-<version>.vsix
code --install-extension openspec-ui-vscode-<version>.vsix
```

## Разработка

```bash
npm run typecheck && npm run lint && npm run test   # юнит-тесты (vitest, мок vscode)
npm run test:integration                             # живой прогон в реальном VS Code
```
