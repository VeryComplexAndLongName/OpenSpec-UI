# Live test notes — vscode-extension

Дата: 2026-08-03. Выполнено в рамках tasks.md 4.1/4.2/4.3, через
`@vscode/test-electron` (`packages/extension/src/test/run.mjs`) — реальный
VS Code Extension Development Host, не мок `vscode`.

## Окружение

Те же, что и в `openspec/changes/standalone-app/smoke-test-notes.md`:
- `claude` CLI — установлен, не авторизован в этом окружении.
- `copilot` CLI — авторизован и рабочий.
- `codex`/`gemini` — не установлены.

## Ход теста

Одноразовый temp-воркспейс (не в репозитории — те же соображения
безопасности, что и у standalone-app: `plan`/`implement` — реальные вызовы
CLI-агента с доступом к инструментам, прогонять их с cwd на реальном
репозитории в рамках smoke-теста неприемлемо), с фиктивным
`openspec/changes/demo/`. Извлечён из репозитория VS Code stable 1.131.0
(скачан `@vscode/test-electron`), запущен Extension Development Host с
`--disable-extensions` (встроенные расширения вроде `vscode.git` остаются
активны — флаг отключает только пользовательские/marketplace-расширения).

### Результат — 5/5 тестов пройдено

1. Расширение активируется, все 8 контрибьютed команд зарегистрированы.
2. Реестр `AgentRunner` строится напрямую (без сети) для всех 5 агентов.
3. Основной режим — serverless по умолчанию (локальный сервер НЕ запущен).
4. **Реальный `plan` через `copilot-cli`**: `started` → реальный ответ
   Copilot (заметил пустое описание задачи, попросил уточнить — корректная
   реакция) → `completed`. ~35s, реальные AI Credits.
5. **Переключение на локальный сервер** (`openspec-ui.transport.localServer.enabled`):
   сервер поднимается на динамическом порту, отдаёт тот же standalone-шелл
   (`<div id="root">` в HTML), выключение настройки останавливает сервер.

## Найденные и исправленные баги

Все три — варианты одной и той же проблемы: Windows резолвит некоторые
CLI/бинари как `.cmd`-шимы, которые `node:child_process`'s `spawn`/`execFile`
без `shell: true` не могут запустить напрямую (`ENOENT`), а `shell: true`
впрямую небезопасен там, где аргументы содержат данные из содержимого
change-файлов.

1. **`copilot` CLI спавнился напрямую** (`agents/shared.ts`) — исправлено
   переходом на `cross-spawn` (см. `standalone-app/smoke-test-notes.md`,
   найдено там же, до этого прогона).
2. **`openspec` CLI (сам бинарь, вызываемый `core/openspec.ts`'s
   `listChanges`/`listSpecs`/`showChange`/`validateChange`) спавнился через
   голый `execFile`** — тот же `ENOENT` на Windows, найдено именно этим
   прогоном (unit-тесты мокали `child_process` целиком и не ловили это;
   standalone-app's smoke-тест не обращался к `openspec` CLI напрямую).
   Исправлено: `openspec.ts` переведён на тот же `cross-spawn`-паттерн, что
   и `agents/shared.ts` (`@openspec-ui/core@0.5.1`).
3. **`server/src/static.ts` падал при импорте внутри забандленного CJS**
   (`import.meta.url` — `undefined` при `esbuild --format=cjs`,
   `fileURLToPath(undefined)` бросает `TypeError` на верхнем уровне модуля,
   до того как вызывающий код успевает передать `staticAssets`-override).
   Обнаружено именно тестом "переключение на локальный сервер" (единственный
   путь, реально импортирующий `@openspec-ui/server` из забандленного
   `extension.js`). Исправлено: вычисление дефолтных путей стало ленивым и
   обёрнуто в try/catch (`@openspec-ui/server@0.1.3`).

## Вывод

`claude-cli` и `copilot-cli` — единственные агенты, доступные для live-
тестирования в этой фазе разработки (см. `execution-core` tasks.md 2.8,
`standalone-app` tasks.md 3.2). `copilot-cli` подтверждён полностью рабочим
end-to-end и в standalone, и в vscode-extension. `codex-cli`/`gemini-cli`
остаются валидированы только моками/contract-тестами.

Ценность этого прогона — не в том, что он "прошёл первого раза" (не прошёл:
нашёл 2 новых реальных бага сверх уже известного из standalone-app), а в
том, что живой прогон внутри настоящего VS Code ловит именно те баги,
которые unit-тесты с моками `vscode`/`child_process` структурно не могут
поймать.
