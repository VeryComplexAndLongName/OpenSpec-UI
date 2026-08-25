## 1. Surface the catalog's actual size

- [x] 1.1 Extend `packages/extension/README.md`'s Templates feature bullet
  with the current template/category counts and language coverage.
- [x] 1.2 Add a template-catalog row to the root `README.md`'s Delivery
  Capability Matrix.

## 2. Version and changelog

- [x] 2.1 Bump `packages/extension/package.json` from `0.20.0` to
  `0.20.1`.
- [x] 2.2 Add a `0.20.1` entry to `packages/extension/CHANGELOG.md`.

## 3. Verification

- [x] 3.1 `npm run lint:english` passes (no accidental non-English text).
- [x] 3.2 `npm run typecheck` and `npm run test` pass workspace-wide
  (docs-only change, but confirming nothing else broke).
- [x] 3.3 Run `openspec change validate --strict surface-template-catalog-growth`.
