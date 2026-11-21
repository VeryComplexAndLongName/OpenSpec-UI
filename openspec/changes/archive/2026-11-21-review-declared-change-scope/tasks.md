## Implementation

- [x] In packages/core/src/change-scope.ts implement `scopeSummary` with bounded strict declarations, path-boundary matching and explicit missing/invalid/changed qualifications.
- [x] In packages/core/src/pr-review.ts read scope from the reviewed head and comparison base and analyze `--no-renames` changed paths for the exact displayed endpoints; append the result to the existing summary.
- [x] In docs/how-to/review-change-scope.md document the JSON format, complete example, declaration-change warning and advisory/committed-only limits.
- [x] In README.md link the scope guide from PR Review.
- [x] In .changeset/review-declared-change-scope.md provide authored minor notes for Core, standalone server and extension without editing version fields.

## Scoped verification

- [x] In packages/core/src/change-scope.test.ts verify file/directory boundaries, case, both rename paths, malicious/missing declarations, empty scopes, changed declarations, limits and Markdown escaping; run only this test file in the Core Vitest project.
- [x] In packages/core/src/pr-review.test.ts add the named declared-scope integration case proving committed mapping reads, rename handling, incremental endpoints and read-only behavior; run only that named case.
- [x] Run `node node_modules/typescript/bin/tsc --noEmit -p packages/core/tsconfig.json` for the affected project and ESLint on the changed Core source/test paths; record actual results.
- [x] Run the existing ChangeActionDialog summary-copy test by name to verify the unchanged summary path retains all text; no new webui/server payload is introduced.
- [x] Call real `readPrReview` on a temporary committed repository and inspect the returned summary for outside paths and declaration qualifications; record the actual output before marking the host-output smoke complete.
- [x] Review every added spec scenario against its exact tests, validate this change strictly and validate the authored changeset summary.

## Evidence and completion

Full verification passed in the implementation PR gates. Record scoped local results and actual CI evidence separately. The standard filtered workspace archive pass will fold the accepted delta after this change lands. Cleanup is operational completion after archived remote main and a clean owned worktree are verified.

## Recorded local verification

Node 24.21.0, npm 10.9.0; isolated npm ci completed without changing the lockfile.

- Core: from packages/core, `node ../../node_modules/vitest/vitest.mjs run --project core src/change-scope.test.ts src/pr-review.test.ts -t 'declared change scope|reviews declared scope'`: 21 passed, 6 unrelated filtered out. The integration case commits two cross-boundary renames, excludes dirty declaration expansion, checks exact incremental endpoints and records the warning after the expansion is committed. The 20 scope tests passed again after correcting an unnecessary regex escape found by scoped ESLint.
- `node node_modules/typescript/bin/tsc --noEmit -p packages/core/tsconfig.json` passed. Scoped ESLint passed on change-scope.ts, change-scope.test.ts, pr-review.ts and pr-review.test.ts. No full suite was run locally.
- Web UI: from packages/webui, `node ../../node_modules/vitest/vitest.mjs run src/components/ChangeActionDialog.test.tsx -t 'shows the fictional example and copies its summary without refreshing'`: 1 passed, 6 filtered out, confirming the unchanged summary-copy path.
- Real smoke: `node node_modules/tsx/dist/cli.mjs C:/Temp/osw-scope-smoke.mts` created an isolated temporary repository and called readPrReview. Its summary reported `Outside declared scope: 1 path`, `unexpected.ts` and the declaration-change qualification. A real authenticated POST /api/change-action returned the exact same complete Core summary. The working tree remained clean; the local server closed and its temporary repository was removed.
- Authored changeset validation: readChangesetFrontmatter/checkChangesetSummary accepted .changeset/review-declared-change-scope.md with Core, standalone server and extension named. Strict OpenSpec validation and git diff --check passed.
- Review: all four added scenarios are exercised by change-scope.test.ts and the named real-git integration. Path-boundary, rename, missing/invalid scope and zero-outside cases retain qualifications. Reads use committed blobs, bound the declaration before loading it, disable external diff/textconv and do not write. No new API payload or agent command/event was added; the authenticated HTTP smoke verifies the actual unchanged transport junction. Remaining limits are the manual declaration, advisory committed-only check and lack of independent approval attribution described in design.md.

- After implementation PR #998 landed, merge-tree reported real conflicts in README.md and pr-review.test.ts. Rebasing resolved those conflicts by retaining both documentation links and both integration tests. The targeted `pr-review.test.ts -t 'reviews declared scope|imports JUnit'` rerun passed both tests (6 unrelated filtered out). Core typecheck and changed-path ESLint passed again on the combined implementation. No rebase was performed solely because main advanced.


## Full CI evidence before archival

Implementation PR gates passed in https://github.com/VeryComplexAndLongName/OpenSpec-UI/actions/runs/44896459688. The standard Workbench archive pass folds the accepted delta into the current specification after the implementation has landed. Targeted local evidence and tooling limitations remain recorded in tasks.md.
