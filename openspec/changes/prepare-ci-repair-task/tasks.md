## Implementation

- [x] In packages/core/src/github-checks.ts expose optional bounded failure observations and read failed-run annotations only on an explicit failure-details request.
- [x] In packages/core/src/http-review-checks.ts retain bounded GitLab failure_reason and Gitea status descriptions only for requested diagnosis and preserve missing detail.
- [x] In packages/core/src/gh-pr-gateway.ts forward optional failure-detail options to the GitHub reader without changing ordinary refresh calls.
- [x] In packages/core/src/http-forges.ts forward optional failure-detail options through each native API adapter.
- [x] In packages/core/src/ci-repair-task.ts format bounded diagnosis and a qualified repair brief with checked/local revisions, absent results, source links and untrusted-data guidance.
- [x] In packages/core/src/pr-review.ts request diagnosis explicitly and return the same prepared brief to both hosts without executing an agent.
- [x] In packages/core/src/change-actions.ts add only the optional prepareCiRepairTask PR Review input; preserve existing agent commands/events.
- [x] In packages/server/src/change-actions-rest.ts forward prepareCiRepairTask to Core unchanged.
- [x] In packages/webui/src/components/ChangeActionDialog.tsx expose preparation and separate accessible copy controls, preserving incremental context.
- [x] In packages/extension/src/commands.ts expose preparation/copy in the native action loop and forward the explicit option to Core.
- [x] In packages/core/src/action-vocabulary.ts register the new control nouns/verbs if missing; do not exempt labels from ADR 0045.
- [x] In packages/core/src/message-register.ts register the distinct CI task copy success/failure messages.
- [x] In packages/core/src/message-register.test.ts retain the new message identifiers in GIVEN and pass the named register tests.
- [x] In docs/messages.md regenerate the registered copy messages and pass the generated-page equality test.
- [x] In docs/how-to/prepare-ci-repair-task.md document both hosts, all three forge detail sources, a complete brief example and essential limits.
- [x] In README.md link the CI repair task guide from the product feature list.
- [x] In .changeset/prepare-ci-repair-task.md provide authored minor notes for every affected delivery without manual version edits.

## Scoped verification

- [x] In packages/core/src/github-checks.test.ts verify explicit bounded annotation reads, ordinary refresh without extra reads, missing permissions and escaped/truncated observations; run only this named file.
- [x] In packages/core/src/http-review-checks.test.ts verify requested GitLab/Gitea detail and incomplete/absent messages; run only this named file.
- [x] In packages/core/src/ci-repair-task.test.ts verify all four spec scenarios, hostile text and bounded output; run only this named file.
- [x] In packages/core/src/pr-review.test.ts verify the explicit option reaches the forge reader and returned brief preserves the real local/published revision relationship; run only its new named case.
- [x] In packages/server/src/change-actions-rest.test.ts verify the new option reaches Core through real authenticated HTTP; run only its new named case.
- [x] In packages/webui/src/components/ChangeActionDialog.test.tsx verify prepare input and exact copied brief; run only its new named case.
- [x] In packages/extension/src/commands.test.ts verify native prepare/copy junctions and no run is launched; run only its new named case.
- [x] Run affected TypeScript project checks and ESLint on changed source/test paths; record exact results instead of a full local suite.
- [x] Read a real failed GitHub check's annotations and inspect the resulting brief, with no PR mutation or agent launch; record the exact run/check used.
- [x] Review every spec scenario, strictly validate the OpenSpec change and validate the authored Changeset notes; record actual evidence.

## Evidence and completion

Full verification is pending in the existing PR CI gates. Complete and archive this change through the standard filtered product archive pass after it lands; remove only its own clean worktree after archived remote main is verified.

## Recorded local verification

Node 24.21.0 and npm 10.9.0. Isolated npm ci completed with the tracked lockfile unchanged. No full package or repository suite ran locally.

- Core reader/formatter tests: from packages/core, `node ../../node_modules/vitest/vitest.mjs run --project core src/github-checks.test.ts src/http-review-checks.test.ts src/ci-repair-task.test.ts`: 13 passed. A follow-up ci-repair-task.test.ts run passed all 5 cases after adding the oversized-link refusal. These cover explicit-only bounded annotation reads, separate same-name run/status provenance, denied detail, GitLab/Gitea option forwarding, absent checks, historical revisions and hostile quoted data.
- Core integration: `node ../../node_modules/vitest/vitest.mjs run --project core src/pr-review.test.ts -t 'CI repair brief in PR Review'`: 1 passed, 7 unrelated filtered out. The exact option reaches the forge and both local/published revisions reach the task and native Markdown preview; the git working tree stays clean.
- Server junction: from packages/server, `node ../../node_modules/vitest/vitest.mjs run src/change-actions-rest.test.ts -t 'prepares CI repair through authenticated HTTP'`: 1 passed, 9 filtered out. A real authenticated local HTTP server calls real Core and its native GitHub HTTP adapter with fixture API responses, reads the requested annotations and returns their exact source/line and commit without editing files.
- Web UI junction: from packages/webui, `node ../../node_modules/vitest/vitest.mjs run src/components/ChangeActionDialog.test.tsx -t 'prepares a CI repair task'`: 1 passed, 9 filtered out. Preparation preserves incremental context; copying is a separate action and writes the exact previewed task. A second selected run including control-vocabulary.test.ts passed 4 tests, 9 filtered out.
- Native junction: from packages/extension, `node ../../node_modules/vitest/vitest.mjs run src/commands.test.ts -t 'PR Review CI repair command adapter|PR Review JUnit command adapter'`: 3 passed, 175 unrelated filtered out. Preparation reaches Core, the real Markdown formatter renders the task, native clipboard receives it, and no scheduler or run plan starts. JUnit collection/refusal remains covered.
- Core vocabulary/register: action-vocabulary.test.ts and message-register.test.ts passed 12 tests, including generated docs equality. github-api-forge.test.ts passed 12 tests for the affected existing API adapter.
- Affected static checks passed: `tsc --noEmit -p` for packages/core, packages/server, packages/webui and packages/extension. Scoped ESLint passed on all changed source/test paths and again on the final formatter/command edits. The standalone client build completed. Strict OpenSpec validation, git diff --check and exact authored Changeset summary validation passed.
- Real external read-only smoke: `node node_modules/tsx/dist/cli.mjs C:/Temp/osw-ci-repair-live.mts` queried the actual failed GitHub check 136815744448 in run https://github.com/VeryComplexAndLongName/OpenSpec-UI/actions/runs/44894037628 for f24e576e8171ad0638628c373c48f80384fc1fd8. The prepared brief retained the vocabulary assertion, packages/webui/src/control-vocabulary.test.ts:95, run link and explicit historical/different-revision warning against ff9e81fb724ca1f432ef76c5ec3947c5743794c6. No PR was mutated and no agent was launched.
- Final review mapped all four delta scenarios to formatter/reader tests and checked each input junction. Source API identifiers determine requests; remote status/annotation URLs are never fetched. Copy is distinct from preparation; optional fields preserve existing clients; unified agent commands/events are unchanged. Remaining limits are provider-supplied partial/generic detail, no full log download, manual agent handoff and private project text requiring review before sharing. Full CI is pending.
