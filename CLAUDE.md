# Инструкции для Claude Code в этом репозитории

Указатели, не дубли — правьте исходный документ, не эту страницу.

## Прежде чем писать код

1. [`docs/adr/0001-shared-core-two-delivery-targets.md`](docs/adr/0001-shared-core-two-delivery-targets.md)
   — архитектурное решение и отклонённые альтернативы. Не переоткрывать без
   нового ADR, особенно решение "extension: прямой import + message bridge
   как основной режим" — оно уже раз пересматривалось по итогам внешней
   рецензии.
2. [`openspec/README.md`](openspec/README.md) — runbook: порядок
   реализации change'ов, когда заводить новую OpenSpec-запись vs просто
   коммит.
3. [`openspec/changes/`](openspec/changes/) — четыре готовых предложения
   (`execution-core`, `shared-ui`, `standalone-app`, `vscode-extension`),
   каждое с `proposal.md`/`design.md`/`tasks.md`/`specs/` — начинайте
   реализацию по `tasks.md` в этом порядке, не с чистого листа.

## Инварианты (см. `openspec/config.yaml`, поле `context`)

- Вся бизнес-логика — только в `packages/core`. `server`/`extension` —
  тонкие адаптеры под свой транспорт, без дублирования логики.
- Единый протокол команд (`plan`/`implement`/`review`/`status`/`cancel`) и
  событий (`started`/`stdout`/`stderr`/`progress`/`completed`/`failed`/
  `cancelled`), определённый только в `packages/core`.
- Security-модель оркестрации CLI-агентов (allowlist, cwd-sandbox, аудит,
  содержимое файлов репозитория — данные, не исполняемые инструкции) —
  обязательная часть `execution-core`, не опциональная доработка.

## Проверки перед коммитом

`npm run typecheck && npm run lint && npm run test` (workspace-wide) — см.
`operations.apply.guidance` в `openspec/config.yaml` за полным списком
(включая обязательный живой smoke-тест для `server`/`extension` перед тем,
как считать задачу выполненной).
