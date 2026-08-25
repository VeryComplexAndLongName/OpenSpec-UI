## 1. Close the gap

- [x] 1.1 Add an `ignore` entry for `@types/vscode` (versions `>=1.91.0`)
  to the `npm` update block in `.github/dependabot.yml`.

## 2. Verification

- [x] 2.1 `.github/dependabot.yml` parses as valid YAML (verified with
  `node node_modules/js-yaml/bin/js-yaml.js .github/dependabot.yml`).
- [x] 2.2 Reproduced the reported failure locally: checked out PR #67's
  branch (`dependabot/npm_and_yarn/npm-development-da559179d1`) into an
  isolated worktree and confirmed `npm run package --workspace
  openspec-ui-vscode` fails with the exact error from the pasted CI log
  ("@types/vscode ^1.134.0 greater than engines.vscode ^1.90.0").
- [x] 2.3 Run `openspec change validate --strict ignore-types-vscode-major`.
