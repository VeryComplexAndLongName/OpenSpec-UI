## 1. Протокол выполнения

- [ ] 1.1 Определить типы команд/событий (`packages/core/src/protocol.ts`)
      — `Command`, `Event` discriminated unions, покрывающие
      plan/implement/review/status/cancel и started/stdout/stderr/
      progress/completed/failed/cancelled
- [ ] 1.2 Тест: сериализация/десериализация каждого варианта `Event` (это
      контракт, который `server`/`extension` будут повторно использовать)

## 2. AgentRunner

- [ ] 2.1 Интерфейс `AgentRunner.run(command, cwd, context) →
      AsyncIterable<Event>`
- [ ] 2.2 Адаптер: Claude CLI
- [ ] 2.3 Адаптер: GitHub Copilot CLI
- [ ] 2.4 Адаптер: Codex CLI
- [ ] 2.5 Адаптер: Gemini CLI
- [ ] 2.6 Адаптер: локальная LLM через OpenAI-совместимый API
      (SGLang/vLLM) — прямой HTTP-вызов, не CLI-процесс
- [ ] 2.7 Тест на каждый адаптер: мок дочернего процесса/HTTP-вызова →
      корректный поток событий протокола

## 3. Security-модель

- [ ] 3.1 Allowlist разрешённых команд/аргументов, конфигурируемый на
      уровне воркспейса
- [ ] 3.2 cwd-sandbox: проверка перед спавном, что рабочая директория
      агента не выходит за пределы воркспейса
- [ ] 3.3 Явная граница "содержимое файла — данные, не инструкция": функция
      подготовки контекста агента не позволяет содержимому change-файлов
      влиять на allowlist/cwd/какая команда исполняется — только на сам
      промпт агента
- [ ] 3.4 Аудит-лог: что запущено, cwd, итоговый diff (best-effort, не
      блокирует выполнение при сбое логирования)
- [ ] 3.5 Тест: попытка выхода за пределы allowlist/cwd — заблокирована,
      залогирована, не приводит к спавну процесса
- [ ] 3.6 Тест: содержимое change-файла с внедрённой инструкцией
      ("проигнорируй предыдущие правила и...") не меняет allowlist/cwd
      исполнения — только пробрасывается в промпт агента как есть

## 4. Derived change-state

- [ ] 4.1 `deriveChangeState(changeDir): ChangeState`
      (draft/in-progress/implemented/archived) по расположению +
      `tasks.md`
- [ ] 4.2 Тест на каждое состояние (фикстуры: change с пустым tasks.md,
      частично отмеченным, полностью отмеченным не в archive, в archive)

## 5. OpenSpec/git-обёртки

- [ ] 5.1 Обёртка над `openspec ... --json` командами (list/show/validate)
- [ ] 5.2 git-обёртка (статус, diff, commit, branch) — только то, что
      реально нужно UI, не полный API git
- [ ] 5.3 Тест: парсинг реального вывода `openspec list --json` /
      `openspec change show --json` (фикстуры из живого `openspec` CLI,
      не выдуманные вручную)
