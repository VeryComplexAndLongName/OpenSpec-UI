## 1. Restore the localStorage fallback

- [x] 1.1 In `packages/webui/src/standalone-entry.tsx`, initialize `cwd` from
  `readStoredValue(STORAGE_KEYS.cwd)` and `changeDir` from
  `readStoredValue(STORAGE_KEYS.changeDir)`.
- [x] 1.2 Bump `packages/webui/package.json` to the next patch version.

## 2. Verification

- [x] 2.1 `npm run lint --workspace @openspec-ui/webui` no longer reports
  `readStoredValue` as unused.
- [x] 2.2 `npm run typecheck` and `npm run test` pass workspace-wide.
- [x] 2.3 Run `openspec change validate --strict restore-standalone-workspace-fallback`.
