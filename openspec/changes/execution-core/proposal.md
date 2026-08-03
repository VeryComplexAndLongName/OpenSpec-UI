## Why

`docs/adr/0001-shared-core-two-delivery-targets.md` фиксирует, что вся
бизнес-логика (openspec-парсинг, git, оркестрация CLI-агентов) должна жить
в одном пакете (`core`), а `server`/`extension` — быть тонкими адаптерами
под свой транспорт. Без этого гарантировано расхождение поведения между
standalone-инструментом и VS Code extension по мере роста функциональности
— именно риск, поднятый во внешней рецензии архитектуры (см. ADR,
"Отклонённые альтернативы"). Этот change — первый: `shared-ui`,
`standalone-app`, `vscode-extension` зависят от протокола команд/событий,
определённого здесь.

## What Changes

- Определяется унифицированный протокол выполнения: команды (`plan`,
  `implement`, `review`, `status`, `cancel`) и поток событий (`started`,
  `stdout`, `stderr`, `progress`, `completed`, `failed`, `cancelled`),
  независимый от того, какой CLI-агент запущен и через какой транспорт
  результат доставляется потребителю.
- Добавляется `AgentRunner` — абстракция запуска CLI-агента с адаптерами
  под Claude CLI, GitHub Copilot CLI, Codex CLI, Gemini CLI и локальную
  LLM через OpenAI-совместимый API (SGLang/vLLM).
- Добавляется security-модель как обязательная часть исполнения, не
  опциональная надстройка: allowlist разрешённых команд/аргументов на
  агента, жёсткий cwd-sandbox, аудит-лог каждого запуска, и явный
  принцип — содержимое файлов репозитория (proposal.md/design.md/issue-
  описания) передаётся агенту как данные контекста, никогда не
  интерпретируется execution engine как собственная инструкция.
- Добавляется derived state machine для статуса change'а
  (draft/in-progress/implemented/archived), вычисляемая эвристически по
  расположению файла (`changes/` vs `changes/archive/`) и доле отмеченных
  `[x]` в `tasks.md` — единственное место, где это вычисляется.
- Добавляется тонкая обёртка над `openspec` CLI (`--json`-команды) и над
  `git` (через `simple-git` или эквивалент) — оба без прямой файловой
  магии в `server`/`extension`.

## Capabilities

### New Capabilities
- `execution-core`: единственный источник правды по поведению — протокол
  выполнения агентов, security-модель, openspec/git-обёртки, derived
  change-state.

### Modified Capabilities
(нет — первая запись)

## Impact

Новый код: `packages/core/` целиком. Прямых зависимостей от HTTP-фреймворков
или VS Code API быть не должно — юнит-тестируется в изоляции (Vitest, без
поднятия сервера/VS Code host).
