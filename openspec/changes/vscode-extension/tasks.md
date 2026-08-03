## 1. Extension Skeleton

- [x] 1.1 Command registration (`openspec.plan`, `openspec.implement`, etc.).
- [x] 1.2 TreeDataProvider for Changes/Archive/Specs.

## 2. Core Integration

- [x] 2.1 Direct import of `execution-core` in extension host.
- [x] 2.2 Message bridge between extension host and webview.
- [x] 2.3 Optional mode: launch local `server` + point webview to localhost
      when setting enabled.

## 3. Native UX

- [x] 3.1 Open specs/docs with VS Code markdown editor commands.
- [x] 3.2 Open diffs using `vscode.diff`.
- [x] 3.3 Integrate built-in Git API for branch/commit actions where applicable.

## 4. Validation

- [x] 4.1 Live smoke test in VS Code: run `plan` and `implement` in primary
      mode with a real CLI agent.
- [x] 4.2 Mode-toggle test: switch to localhost mode and verify same workflow.
- [x] 4.3 Document current live-agent coverage in test notes:
      only Claude CLI and GitHub Copilot CLI are available for live testing in
      this development phase; other adapters are validated through
      mocks/contract tests.

## 5. Marketplace Publishing Readiness

Scope decided with the user: local/internal use only, not published to the
public VS Code Marketplace (see CHANGELOG.md). 5.6's publish step is
intentionally skipped for that reason; everything else is done for real.

- [x] 5.1 Prepare extension metadata in `packages/extension/package.json`:
      `publisher`, `displayName`, `description`, `categories`, `keywords`,
      `engines.vscode`, `repository`, `license`.
- [x] 5.2 Add release assets: `README.md`, `CHANGELOG.md`, `LICENSE`, and icon
      (`icon` field in manifest).
- [x] 5.3 Validate contribution points and activation events:
      commands, configuration keys, and command titles are stable and
      user-facing text is consistent.
- [x] 5.4 Run prepublish quality gate:
      `npm run typecheck && npm run lint && npm run test` plus extension smoke
      test in VS Code.
- [x] 5.5 Bump `packages/extension` version according to semver policy and
      ensure changelog entry matches released behavior.
- [x] 5.6 Package and verify install locally (`vsce package`, install `.vsix`)
      — verified for real (`code --install-extension`, confirmed via
      `code --list-extensions`). Marketplace publish skipped (local-only
      scope, see above).