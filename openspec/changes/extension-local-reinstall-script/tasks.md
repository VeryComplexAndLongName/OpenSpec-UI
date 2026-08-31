## 1. Implement

- [x] 1.1 `packages/extension/scripts/reinstall-local.mjs`: runs `npm run
  package` (build + `vsce package --no-dependencies`, via
  `execFileSync`, inheriting stdio), reads `version` from
  `packages/extension/package.json` to construct
  `openspec-ui-vscode-<version>.vsix`, verifies that file exists after
  packaging, then runs `code --install-extension <absolute path>
  --force`. Any step's failure propagates (no swallowed errors, since
  `execFileSync` throws on non-zero exit). On success, prints a reminder
  that "Developer: Reload Window" is still a required manual step.
- [x] 1.2 `packages/extension/package.json`: added `"reinstall:local":
  "node scripts/reinstall-local.mjs"`.
- [x] 1.3 `packages/extension/README.md`'s "Development" section: added
  `npm run reinstall:local --workspace openspec-ui-vscode` with a note on
  what it does differently from `npm run package` (also force-installs).

## 2. Verification

- [x] 2.1 `openspec change validate --strict
  extension-local-reinstall-script` — passes.
- [x] 2.2 Live run: `npm run reinstall:local --workspace
  openspec-ui-vscode` from repo root rebuilt, repackaged, and
  force-installed successfully end to end. Confirmed via `code
  --list-extensions --show-versions` (`openspec-ui.openspec-ui-vscode@
  0.30.0` present) and the installed extension folder's files timestamped
  at the moment the script ran (`~/.vscode/extensions/openspec-ui.
  openspec-ui-vscode-0.30.0/`).
- [x] 2.3 No changeset needed for this change itself (local developer
  tooling only, no `packages/core`/`server`/`webui` change, no
  product-facing behavior) — matches the precedent already set by
  `openspec/changes/changeset-version-automation/` and
  `openspec/changes/internal-version-cascade/`.
