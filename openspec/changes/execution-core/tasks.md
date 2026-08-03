## 1. Протокол выполнения

- [x] 1.1 Определить типы команд/событий (`packages/core/src/protocol.ts`)
      — `Command`, `Event` discriminated unions, покрывающие
      plan/implement/review/status/cancel и started/stdout/stderr/
      progress/completed/failed/cancelled
- [x] 1.2 Тест: сериализация/десериализация каждого варианта `Event` (это
      контракт, который `server`/`extension` будут повторно использовать)

## 2. AgentRunner

- [x] 2.1 Интерфейс `AgentRunner.run(command, cwd, context) →
      AsyncIterable<Event>`
- [x] 2.2 Адаптер: Claude CLI
- [x] 2.3 Адаптер: GitHub Copilot CLI
- [x] 2.4 Адаптер: Codex CLI
- [x] 2.5 Адаптер: Gemini CLI
- [x] 2.6 Адаптер: локальная LLM через OpenAI-совместимый API
      (SGLang/vLLM) — прямой HTTP-вызов, не CLI-процесс
- [x] 2.7 Тест на каждый адаптер: мок дочернего процесса/HTTP-вызова →
      корректный поток событий протокола

## 3. Security-модель

- [x] 3.1 Allowlist разрешённых команд/аргументов, конфигурируемый на
      уровне воркспейса
- [x] 3.2 cwd-sandbox: проверка перед спавном, что рабочая директория
      агента не выходит за пределы воркспейса
- [x] 3.3 Явная граница "содержимое файла — данные, не инструкция": функция
      подготовки контекста агента не позволяет содержимому change-файлов
      влиять на allowlist/cwd/какая команда исполняется — только на сам
      промпт агента
- [x] 3.4 Аудит-лог: что запущено, cwd, итоговый diff (best-effort, не
      блокирует выполнение при сбое логирования)
- [x] 3.5 Тест: попытка выхода за пределы allowlist/cwd — заблокирована,
      залогирована, не приводит к спавну процесса
- [x] 3.6 Тест: содержимое change-файла с внедрённой инструкцией
      ("проигнорируй предыдущие правила и...") не меняет allowlist/cwd
      исполнения — только пробрасывается в промпт агента как есть

## 4. Derived change-state

- [x] 4.1 `deriveChangeState(changeDir): ChangeState`
      (draft/in-progress/implemented/archived) по расположению +
      `tasks.md`
- [x] 4.2 Тест на каждое состояние (фикстуры: change с пустым tasks.md,
      частично отмеченным, полностью отмеченным не в archive, в archive)

## 5. OpenSpec/git-обёртки

- [x] 5.1 Обёртка над `openspec ... --json` командами (list/show/validate)
- [x] 5.2 git-обёртка (статус, diff, commit, branch) — только то, что
      реально нужно UI, не полный API git
- [x] 5.3 Тест: парсинг реального вывода `openspec list --json` /
      `openspec change show --json` (фикстуры из живого `openspec` CLI,
      не выдуманные вручную)
