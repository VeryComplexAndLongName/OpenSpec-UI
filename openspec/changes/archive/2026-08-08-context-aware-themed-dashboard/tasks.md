# Context-Aware Themed Dashboard Tasks

## 1. Dashboard context

- [x] 1.1 Add typed dashboard reveal context and safe initial webview bootstrap
      attributes in `packages/extension/src/webview/ai-panel.ts`.
- [x] 1.2 Pass workspace/change paths from dashboard commands and refresh an
      existing panel through a context message.
- [x] 1.3 Initialize and update extension-entry path fields from host context
      with focused tests.

## 2. VS Code theme integration

- [x] 2.1 Add extension-only semantic CSS overrides using standard VS Code
      webview variables.
- [x] 2.2 Verify light/dark/high-contrast-compatible tokens without changing
      standalone CSS behavior.

## 3. Release and verification

- [x] 3.1 Bump webui to 0.3.0 and extension to 0.4.0; update release notes and
      package lock workspace versions.
- [x] 3.2 Run affected-package typecheck, lint, and unit tests.
- [x] 3.3 Run workspace-wide typecheck, lint, and tests plus strict OpenSpec
      validation.
- [x] 3.4 Build/package the extension and pass the real VS Code integration
      smoke suite.
