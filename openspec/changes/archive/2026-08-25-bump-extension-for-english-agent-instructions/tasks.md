## 1. Reconcile version and changelog

- [x] 1.1 Bump `packages/extension/package.json`'s `version` from `0.16.2`
  to `0.16.3`.
- [x] 1.2 Add a `0.16.3` entry to `packages/extension/CHANGELOG.md`
  describing the English-instead-of-Russian CLI-agent instruction text.

## 2. Verification

- [x] 2.1 `npm run typecheck` passes workspace-wide.
- [x] 2.2 `npm run lint` passes workspace-wide (including `lint:english`).
- [x] 2.3 `npm run test` passes workspace-wide.
- [x] 2.4 Run `openspec change validate --strict bump-extension-for-english-agent-instructions`.
