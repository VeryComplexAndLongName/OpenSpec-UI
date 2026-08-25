## 1. Reconcile the version number

- [x] 1.1 Bump `packages/core/package.json`'s `version` from `0.20.2` to
  `0.20.3`.

## 2. Verification

- [x] 2.1 `npm run typecheck` passes workspace-wide.
- [x] 2.2 `npm run test` passes workspace-wide.
- [x] 2.3 Run `openspec change validate --strict bump-core-version-for-prompt-text-change`.
