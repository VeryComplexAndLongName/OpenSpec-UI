## Why

<!-- Fill in: what forces this change now — a specific feature that needs
persistence, or a specific pain point with the current storage approach. -->

## What Changes

- Add a SQLAlchemy declarative `Base`, engine, and session factory to
  `{{packageName}}/db.py`, reading the connection string from
  `{{databaseUrlEnvVar}}`.
- Add Alembic migration scaffolding (`alembic.ini`, `migrations/`) wired
  to the same `Base.metadata`.
- Add the first migration revision.

## Capabilities

### New Capabilities

- `data-layer`: <fill in what this actually covers in your project>

### Modified Capabilities

(fill in if this touches an existing capability's persistence behavior)

## Impact

- New: `{{packageName}}/db.py`, `alembic.ini`, `migrations/env.py`,
  `migrations/versions/<first-revision>.py`.
- Dependencies: `sqlalchemy`, `alembic` (and a driver — e.g.
  `psycopg[binary]` for PostgreSQL).
