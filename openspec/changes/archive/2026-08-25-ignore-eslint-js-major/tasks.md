## 1. Close the gap

- [x] 1.1 Add an `ignore` entry for `@eslint/js` (versions `>=10.0.0`) to
  the `npm` update block in `.github/dependabot.yml`.

## 2. Verification

- [x] 2.1 `.github/dependabot.yml` parses as valid YAML (verified with
  `node node_modules/js-yaml/bin/js-yaml.js .github/dependabot.yml`).
- [x] 2.2 Reproduced the reported failure locally: checked out PR #62's
  branch (`dependabot/npm_and_yarn/npm-development-877558e1f1`) into an
  isolated worktree and confirmed `npm ci` fails with the exact ERESOLVE
  conflict this change prevents going forward.
- [x] 2.3 Run `openspec change validate --strict ignore-eslint-js-major`.
