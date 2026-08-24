## Why

Raised directly during a repository review session on 2026-08-24 (the user's
own observation that OpenSpec's governed workflow is not understood by
newcomers): `README.md`'s "Getting Started" section (lines 294-306) still
tells a new reader to "Start with `openspec/changes/execution-core/`", then
`shared-ui`, `standalone-app`, `vscode-extension`. All four of those changes
are already implemented and archived under `openspec/changes/archive/`
(`2026-08-13-execution-core`, `2026-08-13-shared-ui`,
`2026-08-13-standalone-app`, `2026-08-13-vscode-extension`) — the directories
this section tells a reader to open no longer exist at that path. A newcomer
following this section hits a dead end, which actively works against the
goal of making the governed OpenSpec workflow understandable. The adjacent
"Architecture at a Glance" section (line 108) has the same staleness: it
describes `openspec/specs/` as populated "after the first `apply`", but the
first `apply` happened long ago and `openspec/specs/` already holds 14
capability specs.

## What Changes

- Rewrite `README.md`'s "Getting Started" section to describe the workflow
  that actually applies today: the four foundational changes are already
  done; every further repository modification (code, tests, docs, tooling)
  follows the same governed cycle (propose → implement `tasks.md` → `openspec
  change validate --strict <id>` → `openspec archive <id>` after live
  verification), with a short diagram of that cycle and a pointer to `openspec
  list` to see what is currently active.
- Drop the now-inaccurate "(after the first `apply`)" qualifier in
  "Architecture at a Glance" (line 108).
- No change to any other README section, to `openspec/README.md`, or to
  `openspec/config.yaml`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this is a documentation-only change)

## Impact

- `README.md`
