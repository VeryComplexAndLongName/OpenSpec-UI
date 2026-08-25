## 1. Restore the specific rule alongside the blanket one

- [x] 1.1 Add the `@types/vscode` (versions `>=1.91.0`) `ignore` entry
  back to `.github/dependabot.yml`, next to the `dependency-name: "*"`
  major-only rule.

## 2. Verification

- [x] 2.1 `.github/dependabot.yml` parses as valid YAML (verified with
  `node node_modules/js-yaml/bin/js-yaml.js .github/dependabot.yml`) and
  both `ignore` entries are present and independently valid.
- [x] 2.2 Run `openspec change validate --strict restore-types-vscode-ignore`.
