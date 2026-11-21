## Implementation

- [ ] In packages/core/src/github-checks.ts expose optional bounded failure observations and read failed-run annotations only on an explicit failure-details request.
- [ ] In packages/core/src/http-review-checks.ts retain bounded GitLab failure_reason and Gitea status descriptions only for requested diagnosis and preserve missing detail.
- [ ] In packages/core/src/gh-pr-gateway.ts forward optional failure-detail options to the GitHub reader without changing ordinary refresh calls.
- [ ] In packages/core/src/http-forges.ts forward optional failure-detail options through each native API adapter.
- [ ] In packages/core/src/ci-repair-task.ts format bounded diagnosis and a qualified repair brief with checked/local revisions, absent results, source links and untrusted-data guidance.
- [ ] In packages/core/src/pr-review.ts request diagnosis explicitly and return the same prepared brief to both hosts without executing an agent.
- [ ] In packages/core/src/change-actions.ts add only the optional prepareCiRepairTask PR Review input; preserve existing agent commands/events.
- [ ] In packages/server/src/change-actions-rest.ts forward prepareCiRepairTask to Core unchanged.
- [ ] In packages/webui/src/components/ChangeActionDialog.tsx expose preparation and separate accessible copy controls, preserving incremental context.
- [ ] In packages/extension/src/commands.ts expose preparation/copy in the native action loop and forward the explicit option to Core.
- [ ] In packages/core/src/action-vocabulary.ts register the new control nouns/verbs if missing; do not exempt labels from ADR 0045.
- [ ] In docs/how-to/prepare-ci-repair-task.md document both hosts, all three forge detail sources, a complete brief example and essential limits.
- [ ] In .changeset/prepare-ci-repair-task.md provide authored minor notes for every affected delivery without manual version edits.

## Scoped verification

- [ ] In packages/core/src/github-checks.test.ts verify explicit bounded annotation reads, ordinary refresh without extra reads, missing permissions and escaped/truncated observations; run only this named file.
- [ ] In packages/core/src/http-review-checks.test.ts verify requested GitLab/Gitea detail and incomplete/absent messages; run only this named file.
- [ ] In packages/core/src/ci-repair-task.test.ts verify all four spec scenarios, hostile text and bounded output; run only this named file.
- [ ] In packages/core/src/pr-review.test.ts verify the explicit option reaches the forge reader and returned brief preserves the real local/published revision relationship; run only its new named case.
- [ ] In packages/server/src/change-actions-rest.test.ts verify the new option reaches Core through real authenticated HTTP; run only its new named case.
- [ ] In packages/webui/src/components/ChangeActionDialog.test.tsx verify prepare input and exact copied brief; run only its new named case.
- [ ] In packages/extension/src/commands.test.ts verify native prepare/copy junctions and no run is launched; run only its new named case.
- [ ] Run affected TypeScript project checks and ESLint on changed source/test paths; record exact results instead of a full local suite.
- [ ] Read a real failed GitHub check's annotations and inspect the resulting brief, with no PR mutation or agent launch; record the exact run/check used.
- [ ] Review every spec scenario, strictly validate the OpenSpec change and validate the authored Changeset notes; record actual evidence.

## Evidence and completion

Full verification is pending in the existing PR CI gates. Complete and archive this change through the standard filtered product archive pass after it lands; remove only its own clean worktree after archived remote main is verified.
