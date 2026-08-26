## 1. Fix the config

- [x] 1.1 Add `"privatePackages": { "version": true, "tag": false }` to
  `.changeset/config.json`.

## 2. Verification

- [x] 2.1 Reproduced the bug: called `@changesets/assemble-release-plan`
  directly against the real changeset, config, and workspace packages;
  confirmed the exact `TypeError: Cannot read properties of undefined
  (reading 'version')` the CLI was silently swallowing.
- [x] 2.2 Confirmed the fix: re-ran the same direct call with
  `privatePackages` set, got a correct release plan (`openspec-ui-vscode`
  0.20.2 -> 0.21.0, `@openspec-ui/webui` 1.9.1 -> 1.10.0).
- [x] 2.3 Confirmed the real CLI end to end: `npx changeset status` now
  lists both packages; `npx changeset version` actually bumps
  `package.json`/`CHANGELOG.md` and consumes the changeset file.
- [x] 2.4 Run `openspec change validate --strict fix-changesets-private-packages-config`.
