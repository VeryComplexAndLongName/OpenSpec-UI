## 1. Constrain the risky bumps

- [x] 1.1 Add an `ignore` entry for `typescript` (versions `>=6.1.0`) to the
  `npm` update block in `.github/dependabot.yml`.
- [x] 1.2 Add an `ignore` entry for `eslint` (versions `>=10.0.0`) to the
  same block.

## 2. Verification

- [x] 2.1 `.github/dependabot.yml` parses as valid YAML (verified with
  `node node_modules/js-yaml/bin/js-yaml.js .github/dependabot.yml`).
- [x] 2.2 Diff reviewed: no other Dependabot behavior (schedule, grouping,
  `github-actions` block) changed.
- [x] 2.3 Run `openspec change validate --strict pin-dependabot-typescript-eslint`.
