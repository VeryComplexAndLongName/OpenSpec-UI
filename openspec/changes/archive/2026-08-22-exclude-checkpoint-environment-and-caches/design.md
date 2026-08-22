## Context

Checkpoint capture currently excludes selected JavaScript build and dependency
directories, but not common Python generated state. Persisted checkpoints may
also contain paths that become excluded after an extension upgrade.

## Decisions

### Delegate repository ignore semantics to Git

For a Git workspace, checkpoint capture asks Git for tracked and untracked
non-ignored files using `git ls-files --cached --others --exclude-standard`.
This honors root and nested `.gitignore` files, negated patterns,
`.git/info/exclude`, and the user's global Git excludes. Tracked files remain
covered even when they match a later ignore rule. If the workspace is not in a
Git repository, capture falls back to the existing filesystem traversal and
the mandatory exact-name exclusions.

Git only returns paths; checkpoint code still validates each path, skips
symbolic links, enforces size limits, and reads file contents itself.

### Exclude generated state by exact basename

Directory exclusions use exact basenames for established generated locations:
`.cache`, `__pycache__`, `.mypy_cache`, `.pytest_cache`, `.ruff_cache`,
`.hypothesis`, `.tox`, `.nox`, `.venv`, and `venv`. File exclusions use exact
basenames for `.env` and `.eslintcache`. Exact matching avoids treating
application source directories containing words such as `cache` as generated
state.

### Sanitize checkpoints during deserialization

Deserialization filters excluded paths from `before`, `after`, and `delta`.
Both extension and standalone recovery already persist deserialized sessions,
so loading an existing journal rewrites it without excluded content. Workspace
files are not removed. Rollback intentionally stops covering excluded paths.

The serialized checkpoint version remains `1` because the representation does
not change and older version-1 documents remain readable.

## Risks

- A user who intentionally keeps source in an exactly named excluded directory
  cannot restore it through workbench rollback. The exclusions are limited to
  conventional generated-state names to reduce this risk.
- Historical `.env` data remains on disk until the upgraded extension activates
  for that workspace and successfully rewrites its journal.
- Git-ignored files are intentionally outside rollback coverage. Teams should
  not ignore source files that must be recoverable through workbench rollback.
