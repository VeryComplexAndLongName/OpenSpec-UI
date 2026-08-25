## 1. Close the gap

- [x] 1.1 Add an `ignore` entry for `vitest` (versions `>=3.0.0`) to the
  `npm` update block in `.github/dependabot.yml`.

## 2. Verification

- [x] 2.1 `.github/dependabot.yml` parses as valid YAML (verified with
  `node node_modules/js-yaml/bin/js-yaml.js .github/dependabot.yml`).
- [x] 2.2 Reproduced the reported failure locally: checked out PR #65's
  branch (`dependabot/npm_and_yarn/npm-development-ad59ef59ec`) into an
  isolated worktree; `npm ci` warns about unsupported Node engines for
  several `vitest@4` transitive deps, and `npm run test` fails with
  "Cannot find module '@rolldown/binding-wasm32-wasi'" — the exact failure
  this change prevents going forward.
- [x] 2.3 Run `openspec change validate --strict ignore-vitest-major`.
