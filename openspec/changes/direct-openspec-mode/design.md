## Context

This change keeps OpenSpec as the source of truth and removes user-facing
reliance on external AI agent CLIs for command execution paths.

## Decisions

- Extension command palette keeps `status` and utility commands
  (`openspec view`, parsed show/validate/specs summary).
- `plan`/`implement`/`review`/`cancel` are removed from contributed command
  surface.
- Status execution is always backed by OpenSpec JSON (`openspec status --json`).
- Standalone/server no longer bootstraps AI runners by default.

## Trade-offs

- Users lose one-click agent orchestration from this UI.
- In return, command behavior is deterministic and significantly faster in
  environments where agent CLIs are blocked or slow.
