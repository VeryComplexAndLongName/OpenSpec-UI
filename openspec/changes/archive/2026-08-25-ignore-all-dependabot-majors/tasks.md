## 1. Replace point fixes with a structural rule

- [x] 1.1 Replace the four package-specific `ignore` entries in
  `.github/dependabot.yml` with one blanket rule: `dependency-name: "*"`,
  `update-types: ["version-update:semver-major"]`.

## 2. Verification

- [x] 2.1 `.github/dependabot.yml` parses as valid YAML (verified with
  `node node_modules/js-yaml/bin/js-yaml.js .github/dependabot.yml`) and
  the `ignore` block matches Dependabot's documented `update-types` schema.
- [x] 2.2 Run `openspec change validate --strict ignore-all-dependabot-majors`.
