## 1. Implementation

- [x] 1.1 In `packages/core/src/git.ts`, make `prepareSingleRefPush` disable and verify redirects at the exact approved HTTP URL.
  Core TypeScript and ESLint passed. Git confirmed the exact endpoint uses followRedirects=false.
- [x] 1.2 In `packages/core/src/git.push.test.ts`, reproduce the redirect with a real local HTTP endpoint and verify that the target receives no request.
  The regression hit /other.git before the fix. The fixed transport contacted only /approved.git and refused the redirect.
- [x] 1.3 Record the HTTP transport decision in ADR 0055.
  ADR 0055 records the exact URL policy.

## 2. Verification and release

- [x] 2.1 Run `vitest run --project core-git-subprocess src/git.push.test.ts` in Core and record the results.
  All three cases in src/git.push.test.ts passed in Ubuntu WSL with Node 24.21.0.
- [x] 2.2 Run `openspec validate an-approved-push-stays-at-its-url --strict` and record the result.
  Strict OpenSpec validation passed.
- [x] 2.3 Add patch release notes for the editor, standalone app and CLI using the proposal's copy. Verify `node --test scripts/release-notes.test.mjs`.
  The changeset names all three public deliveries. All four release-note tests passed.
