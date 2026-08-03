## 1. Extension Skeleton

- [ ] 1.1 Command registration (`openspec.plan`, `openspec.implement`, etc.).
- [ ] 1.2 TreeDataProvider for Changes/Archive/Specs.

## 2. Core Integration

- [ ] 2.1 Direct import of `execution-core` in extension host.
- [ ] 2.2 Message bridge between extension host and webview.
- [ ] 2.3 Optional mode: launch local `server` + point webview to localhost
      when setting enabled.

## 3. Native UX

- [ ] 3.1 Open specs/docs with VS Code markdown editor commands.
- [ ] 3.2 Open diffs using `vscode.diff`.
- [ ] 3.3 Integrate built-in Git API for branch/commit actions where applicable.

## 4. Validation

- [ ] 4.1 Live smoke test in VS Code: run `plan` and `implement` in primary
      mode with a real CLI agent.
- [ ] 4.2 Mode-toggle test: switch to localhost mode and verify same workflow.
- [ ] 4.3 Document current live-agent coverage in test notes:
      only Claude CLI and GitHub Copilot CLI are available for live testing in
      this development phase; other adapters are validated through
      mocks/contract tests.