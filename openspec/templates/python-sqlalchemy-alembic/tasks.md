## 1. SQLAlchemy setup

- [ ] 1.1 Add `{{packageName}}/db.py`: declarative `Base`, `engine` built
  from `os.environ["{{databaseUrlEnvVar}}"]`, and a session factory.
- [ ] 1.2 Add the first model(s) using `Base`.

## 2. Alembic setup

- [ ] 2.1 `alembic init migrations` (or equivalent) and point
  `migrations/env.py`'s `target_metadata` at `Base.metadata` from
  `{{packageName}}/db.py`.
- [ ] 2.2 Configure `alembic.ini`'s `sqlalchemy.url` to read from
  `{{databaseUrlEnvVar}}` (not a hardcoded connection string).
- [ ] 2.3 Generate and review the first revision
  (`alembic revision --autogenerate -m "initial schema"`).
- [ ] 2.4 Apply it against a real database and confirm the resulting
  schema matches the models (`alembic upgrade head`).

## 3. Verification

- [ ] 3.1 Add a test that imports `{{packageName}}/db.py` and confirms the
  engine/session factory construct without error given a valid
  `{{databaseUrlEnvVar}}`.
