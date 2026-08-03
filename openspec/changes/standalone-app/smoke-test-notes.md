# Live smoke-test notes — standalone-app

Дата: 2026-08-03. Выполнено в рамках tasks.md 3.1/3.2.

## Окружение

- `claude` CLI: `C:\Users\ivanov.a\.local\bin\claude.exe` — установлен, но
  **не авторизован** в этом окружении (`Not logged in · Please run /login`).
  Это отдельная установка, не связанная с сессией, в которой выполняется
  сама разработка.
- `copilot` CLI: `C:\Users\ivanov.a\AppData\Roaming\npm\copilot` (npm-шим,
  реально резолвится в `copilot.cmd` на Windows) — авторизован и рабочий.
- `codex`, `gemini` — не установлены в этом окружении. Их адаптеры
  валидируются только моками/contract-тестами (см. `execution-core`
  tasks.md 2.7/2.8) — реальный live-прогон для них в этой фазе разработки
  недоступен.

## Ход теста

1. Поднят `packages/server` (`npm run start`) с `workspaceRoot`, указывающим
   на одноразовую scratch-директорию (не на реальный репозиторий — см.
   ниже, "Почему не на реальном репозитории").
2. Открыт браузерный шелл (`packages/server/public/index.html` +
   собранный `dist/app.js`) через реальный HTTP-запрос в браузере.
3. В AI-панели указаны `cwd`/`changeDir` на scratch-директорию, выбран
   агент, запущена команда `plan`.

### Попытка 1 — `claude-cli`

Результат: `started` → `stdout` (`Not logged in · Please run /login`) →
`failed: claude завершился с кодом 1`. Ожидаемо — реальный CLI не
авторизован в этом окружении. Подтверждает, что спавн процесса, передача
аргументов и перехват stdout/exit-кода работают корректно (ошибка —
окружения, не кода).

### Попытка 2 — `copilot-cli`, до исправлений

Результат: `failed: spawn copilot ENOENT`.

**Найденный баг**: `agents/shared.ts`'s `spawnAndStream` использовал голый
`node:child_process.spawn(executable, args)` без `shell: true`. На Windows
`copilot` резолвится в `.cmd`-шим (`copilot.cmd`), а не в `.exe` — Node не
может запустить `.cmd` напрямую без интерпретатора. Включать `shell: true`
впрямую было бы небезопасно: `copilot`'s промпт (может содержать
произвольное содержимое change-файлов) передаётся именно как argv-аргумент,
и голый `shell: true` открыл бы shell-инъекцию через этот аргумент.

**Исправление**: `agents/shared.ts` переведён на `cross-spawn` — корректно
резолвит `.cmd`/`.bat` на Windows, экранируя каждый аргумент по отдельности,
не интерпретируя итоговую командную строку в шелле. См.
`packages/core/src/agents/shared.ts`, `@openspec-ui/core@0.4.1`.

### Попытка 3 — `copilot-cli`, после исправления spawn

Результат: `started` → `stdout` (`No task was specified in your message —
"--allow-all-tools" is a flag, not a request...`) → `completed`.

**Найденный баг**: `CopilotCliAdapter` передавал промпт через stdin (как и
Claude/Codex/Gemini), но `copilot -p` не читает stdin — промпт должен быть
позиционным аргументом сразу после `-p`.

**Исправление**: `CopilotCliAdapter.execute()` теперь встраивает промпт в
argv (`["-p", prompt, "--allow-all-tools"]`) уже после того, как
`buildInvocation()`'s статическая форма (`["-p", "--allow-all-tools"]`)
прошла allowlist-проверку — содержимое промпта по-прежнему не влияет на то,
разрешён ли сам запуск (см. `packages/core/src/agents/copilot.ts`).

### Попытка 4 — `copilot-cli`, после обоих исправлений

Результат: `started (plan)` → `stdout` (реальный ответ Copilot: корректно
заметил, что описание change'а пусто, и попросил уточнить задачу) →
`completed`. Реально потрачены AI Credits (9.05, ~10s), токены — see
Copilot's own usage line in the output. **Полный pipeline подтверждён
end-to-end**: браузер → WebSocket → `server` → `execution-core`'s
`AgentRunner` → реальный процесс CLI-агента → поток событий → рендер в
браузере.

## Почему не на реальном репозитории

`plan`/`implement`/`review` — это настоящие вызовы CLI-агента с доступом к
инструментам (`--allow-all-tools` для copilot, аналогично для claude).
Прогонять их с `cwd`, указывающим на `C:\Prog\OpenSpec-UI`, означало бы
доверить реальному репозиторию непроверенному агентскому прогону в рамках
smoke-теста. Вместо этого `workspaceRoot`/`cwd` указывали на одноразовую
scratch-директорию с фиктивным `openspec/changes/demo/proposal.md` —
изоляция полностью убирает этот риск, не жертвуя ничем в проверке самого
pipeline.

## Вывод

- `claude-cli` и `copilot-cli` — единственные агенты, доступные для live-
  тестирования в этой фазе разработки (см. также `execution-core`
  tasks.md 2.8). `copilot-cli` подтверждён полностью рабочим end-to-end.
  `claude-cli` подтверждён механически рабочим (spawn/argv/stdout/exit-код),
  но не был протестирован end-to-end из-за отсутствия авторизации в этом
  окружении — это ограничение окружения, не блокер для archive.
- `codex-cli`/`gemini-cli` остаются валидированы только моками/contract-
  тестами — CLI не установлены в этом окружении.
- Оба найденных бага (spawn `.cmd` на Windows, copilot's argv-vs-stdin)
  исправлены в `@openspec-ui/core` и покрыты юнит-тестами
  (`agents/shared.test.ts`, `agents/copilot.test.ts`).
