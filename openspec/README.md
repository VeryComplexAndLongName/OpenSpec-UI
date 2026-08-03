# OpenSpec в этом репозитории — runbook

## Порядок реализации

Зависимости между change'ами — строго в этом порядке, `server`/`webui`/
`extension` полагаются на протокол, определённый в `execution-core`:

1. `openspec/changes/execution-core/` — сначала. Определяет протокол
   команд/событий и security-модель, от которых зависит всё остальное.
2. `openspec/changes/shared-ui/` — после `execution-core` (или параллельно,
   если протокол уже зафиксирован в design.md и не будет меняться).
3. `openspec/changes/standalone-app/` и `openspec/changes/vscode-extension/`
   — параллельно, оба зависят от `execution-core` + `shared-ui`.

## Когда заводить новую OpenSpec-запись vs просто коммит

```
Меняется контракт (`## Requirement`) в openspec/specs/*?
├── Да  → propose (или update, если change ещё активен) → apply → archive
└── Нет — багфикс/рефакторинг без изменения поведения
      → просто git-коммит с подробным сообщением
```

## Какую команду/skill когда

| Ситуация | Действие |
|---|---|
| Начать реализацию `execution-core`/`shared-ui`/`standalone-app`/`vscode-extension` | `openspec-apply-change` — идёт по `tasks.md` соответствующего change'а, уже созданного при планировании |
| Новая capability сверх исходных четырёх | `openspec-propose` |
| Change реализован и подтверждён (contract tests зелёные, ручной smoke-тест) | `openspec-archive-change` — см. `operations.archive.guidance` в `config.yaml` за тем, что обязано быть подтверждено перед архивацией |
| Нужно скорректировать ещё не заархивированный change (новые вводные, ошибка в design.md) | `openspec-update-change` |
| Правка формулировки в уже архивной спеке без полного цикла | `openspec-sync-specs` |

## Формат запроса к агенту

- **Для apply**: «примени change `execution-core`» — агент читает
  `tasks.md`, идёт по списку. Задачи security-модели (allowlist/cwd-sandbox/
  аудит) не отмечаются выполненными без теста — см. `rules.tasks` в
  `config.yaml`.
- **Для archive**: только после того, как contract tests между `webui` и
  `server`/`extension` реально прошли — не «выглядит готовым».
- **Если меняется протокол команд/событий** (см. `context` в `config.yaml`
  за списком) — явно скажите агенту, что это затрагивает уже реализованные
  адаптеры, чтобы design.md зафиксировал обратную совместимость или
  явный breaking change.
