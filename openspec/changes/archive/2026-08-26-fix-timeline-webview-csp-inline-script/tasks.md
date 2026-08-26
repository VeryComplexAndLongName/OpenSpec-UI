## 1. Fix

- [x] 1.1 Add a per-panel nonce in `timeline-panel.ts`'s `getHtml()`,
  included in the CSP's `script-src` and on the inline data-injection
  `<script>` tag.

## 2. Verification

- [x] 2.1 Reproduced the exact bug and confirmed the fix in a
  Playwright test loading real HTML with the actual CSP meta tag
  applied (not a bare, unrestricted page, unlike prior smoke tests):
  without a nonce, the inline script is blocked and no console error
  is visible (matching the user's silent "No timeline data" report);
  with the matching nonce, zero CSP violations and real data renders.
- [x] 2.2 Add `timeline-panel.test.ts` covering the nonce/CSP
  relationship as a lasting regression test, not just an ad hoc script.
- [x] 2.3 `npm run typecheck` and `npm run test` pass for
  `openspec-ui-vscode`; `npm run lint` (including `lint:english`)
  passes workspace-wide.
- [x] 2.4 Rebuild the VSIX (`npm run package --workspace
  openspec-ui-vscode`) and confirm it packages without error.
- [x] 2.5 Propose a changeset (`npx changeset`) for `openspec-ui-vscode`
  (patch: bug fix, no new capability) instead of hand-editing
  `version`/`CHANGELOG.md`; apply it via `npx changeset version`.
- [x] 2.6 Run `openspec change validate --strict
  fix-timeline-webview-csp-inline-script`.
