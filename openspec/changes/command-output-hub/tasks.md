## 1. shared-ui: Structured command output

- [x] 1.1 Extend AI panel command picker to include `status`.
- [x] 1.2 Implement structured event rendering for stdout/stderr/completed
      payloads (JSON, checklist, key-value, bullets, fallback text).
- [x] 1.3 Add/adjust AI panel tests to verify parsing and rendering behavior.

## 2. vscode-extension: Utility command menu

- [x] 2.1 Add command palette action to launch `openspec view` in an integrated
      terminal rooted at the active workspace.
- [x] 2.2 Add parsed UI action for selected change details (from
      `showChange(...)`) rendered as Markdown document.
- [x] 2.3 Add parsed UI action for selected change strict validation
      (from `validateChange(...)`) rendered as Markdown document.
- [x] 2.4 Update command registration tests for new command IDs and
      representative behavior.

## 3. Verification

- [ ] 3.1 `npm run test --workspace @openspec-ui/webui`
      Blocked in current environment by upstream dependency/runtime error:
      `ERR_REQUIRE_ESM` in `html-encoding-sniffer` -> `@exodus/bytes` during
      Vitest/jsdom bootstrap.
- [x] 3.2 `npm run test --workspace openspec-ui-vscode`
