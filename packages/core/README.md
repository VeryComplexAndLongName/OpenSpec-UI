# @openspec-ui/core

Execution engine, протокол команд/событий, security-модель, openspec/git-
обёртки, derived change-state. Единственный источник правды по поведению —
не зависит от HTTP-фреймворков или `vscode` API (юнит-тестируется в
изоляции).

Реализовано по `openspec/changes/execution-core/tasks.md` — см. корневой
`openspec/README.md` за порядком работы. Спецификация поведения —
`openspec/changes/execution-core/specs/execution-core/spec.md`.

## Модули

- `protocol.ts` — `Command`/`Event` discriminated unions: единственное
  место, где определён протокол `plan`/`implement`/`review`/`status`/
  `cancel` и поток событий `started`/`stdout`/`stderr`/`progress`/
  `completed`/`failed`/`cancelled`.
- `agent-runner.ts` — `AgentRunner`/`AgentAdapter`: security-проверки
  (allowlist, cwd-sandbox) и аудит-лог выполняются здесь, inline, до того,
  как управление передаётся конкретному адаптеру.
- `security.ts` — `checkAllowlist`, `checkCwdSandbox`, `prepareAgentContext`
  (граница "содержимое файла — данные, не инструкция"), `AuditLog`.
- `agents/` — адаптеры: `claude.ts`, `copilot.ts`, `codex.ts`, `gemini.ts`
  (дочерний процесс через `agents/shared.ts`) и `local-llm.ts` (HTTP,
  OpenAI-совместимый API — SGLang/vLLM).
- `change-state.ts` — `deriveChangeState` (чистая функция от расположения
  директории change'а + содержимого `tasks.md`) и `readChangeState`
  (обёртка с чтением файла).
- `openspec.ts` — обёртка над `openspec ... --json` (list/show/validate).
- `git.ts` — обёртка над `simple-git` (status/diff/commit/branch — только
  то, что нужно UI).

## Allowlist по умолчанию

`security.ts` не содержит захардкоженного allowlist — конфигурация
(`AllowlistConfig`) передаётся вызывающей стороной (`server`/`extension`)
на уровне воркспейса. Агент, отсутствующий в конфиге, не разрешён ни для
одной команды (restrictive default, см. design.md).

## Эвристика derived change-state

- `archived` — директория change'а лежит под сегментом пути `archive`
  (`openspec/changes/archive/...`), независимо от состояния `tasks.md`.
- `draft` — `tasks.md` отсутствует, не содержит пунктов чеклиста, или ни
  один пункт не отмечен `[x]`.
- `in-progress` — отмечена часть пунктов.
- `implemented` — отмечены все пункты.

Статус не хранится как явное поле — только вычисляется по требованию. Это
эвристика, не более точная, чем позволяет структура OpenSpec (см. риски в
`design.md`).
