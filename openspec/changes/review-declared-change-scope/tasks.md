## Implementation

- [ ] In packages/core/src/change-scope.ts implement `scopeSummary` with bounded strict declarations, path-boundary matching and explicit missing/invalid/changed qualifications.
- [ ] In packages/core/src/pr-review.ts read scope from the reviewed head and comparison base and analyze `--no-renames` changed paths for the exact displayed endpoints; append the result to the existing summary.
- [ ] In docs/how-to/review-change-scope.md document the JSON format, complete example, declaration-change warning and advisory/committed-only limits.
- [ ] In README.md link the scope guide from PR Review.
- [ ] In .changeset/review-declared-change-scope.md provide authored minor notes for Core, standalone server and extension without editing version fields.

## Scoped verification

- [ ] In packages/core/src/change-scope.test.ts verify file/directory boundaries, case, both rename paths, malicious/missing declarations, empty scopes, changed declarations, limits and Markdown escaping; run only this test file in the Core Vitest project.
- [ ] In packages/core/src/pr-review.test.ts add the named declared-scope integration case proving committed mapping reads, rename handling, incremental endpoints and read-only behavior; run only that named case.
- [ ] Run `node node_modules/typescript/bin/tsc --noEmit -p packages/core/tsconfig.json` for the affected project and ESLint on the changed Core source/test paths; record actual results.
- [ ] Run the existing ChangeActionDialog summary-copy test by name to verify the unchanged summary path retains all text; no new webui/server payload is introduced.
- [ ] Call real `readPrReview` on a temporary committed repository and inspect the returned summary for outside paths and declaration qualifications; record the actual output before marking the host-output smoke complete.
- [ ] Review every added spec scenario against its exact tests, validate this change strictly and validate the authored changeset summary.

## Evidence and completion

Full verification is pending in the existing PR CI gates. Record scoped local results and actual CI evidence separately. The standard filtered workspace archive pass will fold the accepted delta after this change lands. Cleanup is operational completion after archived remote main and a clean owned worktree are verified.
