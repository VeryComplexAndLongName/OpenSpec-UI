## 1. Rewrite the stale onboarding narrative

- [x] 1.1 Replace `README.md`'s "Getting Started" section: remove the
  "start with `execution-core`" bootstrap sequence (already archived) and
  describe the current propose/implement/validate/archive cycle, with a
  pointer to `openspec list` for what is currently active.
- [x] 1.2 Remove the "(after the first `apply`)" qualifier in "Architecture
  at a Glance" now that `openspec/specs/` is populated.

## 2. Verification

- [x] 2.1 Every path and command referenced in the rewritten section
  actually exists / runs (`openspec/README.md`, `openspec/config.yaml`,
  `openspec list`, `openspec change validate --strict`, `openspec archive`).
- [x] 2.2 `npm run lint:english` passes (no new Cyrillic introduced).
- [x] 2.3 Run `openspec change validate --strict refresh-readme-getting-started`.
