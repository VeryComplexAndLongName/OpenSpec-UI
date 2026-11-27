## Implementation

- [x] Bound artifact downloads and verify the checkout identity in `packages/core/src/ci-junit.ts`.
- [x] Declare the existing locked ZIP reader as a Core dependency in `packages/core/package.json`.
- [x] Record its runtime use and types in `package-lock.json`.
- [x] Keep the ZIP reader external in `packages/cli/scripts/build.mjs` so the ESM package can load its CommonJS dependency.
- [x] Ship that ZIP reader as a runtime dependency in `packages/cli/package.json`.
- [x] Expose read-only report retrieval as `Forge.readCiJUnit` in `packages/core/src/gh-pr-gateway.ts`.
- [x] Route Gitea and GitLab authentication in `packages/core/src/http-forges.ts`.
- [x] Preserve CI provenance in `packages/core/src/junit-evidence.ts`.
- [x] Import CI results through `packages/core/src/pr-review.ts` with the displayed revision.
- [x] Add an optional import request in `packages/core/src/change-actions.ts`.
- [x] Guard the import as a worktree write in `packages/server/src/change-actions-rest.ts`.
- [x] Add an import control to `packages/webui/src/components/ChangeActionDialog.tsx`.
- [x] Add the native import action in `packages/extension/src/commands.ts`.
- [x] Register the control noun in `packages/core/src/action-vocabulary.ts`.
- [x] Describe the artifact layout and access in `docs/how-to/link-scenarios-to-tests.md`.
- [x] Publish a small checked JUnit example artifact in `.gitea/workflows/quality.yml`.
- [x] Record delivery notes in `.changeset/import-junit-from-ci.md`.

## Verification

- [x] Run `packages/core/src/ci-junit.test.ts` to check provider binding, limits and redirects.
- [x] Run the named CI JUnit test in `packages/core/src/pr-review.test.ts` to check retained provenance and refusal.
- [x] Run the CI JUnit REST contract in `packages/server/src/change-actions-rest.test.ts`.
- [x] Run the dialog and vocabulary tests for the standalone action.
- [x] Run the native CI JUnit command test in `packages/extension/src/commands.test.ts`.
- [x] Run the CI import smoke in `packages/server/e2e/junit-review.spec.ts`.
- [x] Run the installed CLI tarball smoke in `packages/cli/scripts/smoke-package.mjs`.
- [x] Run strict OpenSpec validation for import-junit-from-ci.

Before archival, verify the artifact from the successful implementation run
with the real Gitea import routine and record the run, artifact and revision.

Targeted Windows checks passed: CI artifact and JUnit parser (23 tests), PR Review provenance (1 test), HTTP contract and write guards (5 tests), standalone dialog and vocabulary (15 tests), native VS Code actions (5 tests), and the live Chromium workflow (1 test). The browser used a local GitLab API fixture. Selected TypeScript projects, changed-file ESLint, strict OpenSpec, Changeset, and Gitea workflow checks passed. The producer command generated a 3,498-byte report locally. Full CI and the live Gitea artifact read follow on the PR.

Follow-up verification: the live Gitea run 8621 produced artifact 18629. Its ZIP endpoint redirected to the signed same-origin raw path. The client followed only that exact path without its token and parsed 17 passing tests for 9b9cbe9f. The revised Core artifact suite and typecheck passed. The isolated installed CLI tarball smoke passed with the ZIP reader external, including help, launch and API/WebSocket checks. Full Gitea verification resumes on the follow-up commit.

Full verification passed in Gitea Quality run 8626 on implementation head 85dfb918e0815c683c47f2c1d5a2ddf51b8814cb.
