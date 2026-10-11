## 1. Webview Theme

- [x] 1.1 Add `packages/webui/src/components/ComplianceApp.tsx` to mount the
  shared Metro root/theme wrapper; verify it renders `openspec-metro` and the
  expected theme class in `ComplianceApp.test.tsx`. Evidence: the focused test
  verifies light, dark, high-contrast and high-contrast-light class changes.
- [x] 1.2 Update `packages/webui/src/compliance-entry.tsx` to render
  `ComplianceApp`; verify the Compliance browser bundle builds.
- [x] 1.3 Verify live body-class transitions for light, dark, high contrast and
  high-contrast-light in `ComplianceApp.test.tsx` without reloading the app.
- [x] 1.4 Run the existing isolated VS Code Compliance smoke and record its
  command and result; do not run the full extension suite locally.
  Evidence: `node packages/extension/src/test/compliance-run.mjs <Code.exe>`
  passed with exit code 0, verifying activation, command, panel tab and disposal
  against the built theme-aware bundle.
- [x] 1.5 Run strict OpenSpec validation and affected webui/extension typechecks.
  Evidence: 18 focused theme tests, both package typechecks, changeset check and
  strict OpenSpec validation passed on 2026-10-11. `complianceWebviewBuildOptions`
  also built `packages/extension/dist/compliance.js` successfully.