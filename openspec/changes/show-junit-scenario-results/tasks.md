## Implementation

- [x] In packages/core/src/junit-evidence.ts implement parseJUnit with strict bounded XML parsing and normalized exact testcase outcomes, excluding all raw output.
- [x] In packages/core/src/junit-evidence.ts implement importJUnit/readJUnit with stale-head checks, validated declared revisions and bounded atomic repository-local persistence shared by worktrees.
- [x] In packages/core/src/junit-evidence.ts implement junitScenarioSummary using the committed scenario-tests.json and exact testcase identities; report invalid, ambiguous and historical evidence without current-pass claims.
- [x] In packages/core/src/pr-review.ts thread the optional import to Core and append scenario testcase evidence to the copied/rendered summary.
- [x] In packages/core/src/change-actions.ts define the additive junitImport payload for showPrReview without changing the agent command/event protocol.
- [x] In packages/server/src/change-actions-rest.ts forward junitImport unchanged and apply the existing write-ownership refusal before importing.
- [x] In packages/webui/src/components/ChangeActionDialog.tsx collect a bounded XML file and an explicit tested commit in an accessible import form and forward both with the displayed head.
- [x] In packages/extension/src/commands.ts collect a bounded XML file and explicit tested commit using native VS Code controls and call the same Core import path.
- [x] In docs/how-to/link-scenarios-to-tests.md document the mapping format, import steps, report limits and user-declared provenance with a complete example.
- [x] In .changeset/show-junit-scenario-results.md record the proposal's product notes for Core, Shared UI, server and extension without changing versions by hand.

- [x] In packages/core/src/action-vocabulary.ts register Import and JUnit XML so the new controls follow ADR 0045; verify action-vocabulary.test.ts and webui control-vocabulary.test.ts.

## Scoped verification

- [x] In packages/core/src/junit-evidence.test.ts exercise outcomes, nested suites, malformed/DTD/size/depth/count refusal, duplicates and mapping/revision qualifications; run node_modules/vitest/vitest.mjs run --project core packages/core/src/junit-evidence.test.ts.
- [x] In packages/core/src/pr-review.test.ts verify imported results appear in readPrReview, survive reopening and never leak raw output; run only that file in its configured Vitest project.
- [x] In packages/server/src/change-actions-rest.test.ts verify the optional import reaches Core and an unverified working directory cannot write it; run that named test file.
- [x] In packages/webui/src/components/ChangeActionDialog.test.tsx verify the selected XML, explicitly entered revision and displayed head reach perform; run that named test file.
- [x] In packages/extension/src/junit-import.test.ts verify native input collection forwards the selected XML and explicit commit and stops on cancelled/oversized files; run only this file.
- [x] In packages/extension/src/junit-import.ts keep native file collection bounded and return only the additive Core input.
- [x] In packages/core/src/message-register.ts register CHG-014/015/016 import refusals.
- [x] In packages/core/src/message-register.test.ts retain the new identifiers in GIVEN and pass its 7 tests.
- [x] In docs/messages.md regenerate the registered refusal documentation and pass the generated-page equality test.
- [x] In packages/core/package.json declare saxes for strict XML parsing rather than a permissive HTML reader.
- [x] In package-lock.json retain the dependency resolution using npm 10.9.0 and verify npm ci succeeds.
- [x] In README.md link the testcase evidence guide from PR Review.
- [x] In packages/extension/src/commands.test.ts verify native helper output reaches readPrReview and ownership refusal prevents collection; run only PR Review JUnit command adapter tests.
- [x] Run affected TypeScript projects and ESLint only on changed source files; record exact commands and results below.
- [x] Verify standalone PR Review presentation in a real browser after authenticated HTTP import into the temporary git fixture; record all six rendered states and the copy confirmation. The form payload is separately covered by ChangeActionDialog.test.tsx and change-actions-rest.test.ts; live file selection is not claimed because Edge blocks automated upload without its file-URL permission.
- [x] Review the final diff against every added scenario, validate the OpenSpec change strictly and record the actual review findings before opening the PR.

## CI and completion evidence

Full verification is pending in the existing PR CI gates. Record the exact checked commit, run URLs and outcomes here after CI, before the standard workspace sweep archives this landed change. Worktree/branch cleanup follows verified archival in remote main and a clean working copy; it is operational completion, not an unexecuted pre-merge verification checkbox.

## Recorded local evidence

Node 24.21.0 and npm 10.9.0. `tsc --noEmit -p` passed for packages/core, packages/webui, packages/server and packages/extension; scoped ESLint passed on changed source/test files. Parser tests additionally pass with explicit notrun/suppressed testcase handling.

- Core: `node ../../node_modules/vitest/vitest.mjs run --project core src/junit-evidence.test.ts src/pr-review.test.ts -t 'JUnit|imports JUnit'`: 17 passed, 6 unrelated tests filtered out. The integration test imports, reopens, rejects unsafe/unknown/stale replacements and reads retained history from a linked worktree.
- Web UI: `node ../../node_modules/vitest/vitest.mjs run src/components/ChangeActionDialog.test.tsx`: 8 passed, including explicit revision/XML payload forwarding.
- Server: `node ../../node_modules/vitest/vitest.mjs run src/change-actions-rest.test.ts`: 9 passed, including authenticated HTTP import, reopening and worktree-ownership refusal. This is the actual webui/server input contract check, complemented by the form transport test above.
- Extension: `node ../../node_modules/vitest/vitest.mjs run src/junit-import.test.ts`: 3 passed, covering native prompt results, cancellation and pre/post-read size checks.
- `changeset status` accepted the named delivery notes. Standalone client build completed successfully.

- Follow-up parser/register run: `node ../../node_modules/vitest/vitest.mjs run --project core src/junit-evidence.test.ts src/message-register.test.ts`: 23 passed after registering CHG-014/015/016 in the identifier ledger and regenerating docs/messages.md.
- Browser smoke: Edge at http://127.0.0.1:4319, fixture commit 00361dbf247d4f7d0fc6ed7c58fbfaade6497a3f. A real authenticated /api/change-action request imported the fixture XML; reopening PR Review rendered passed, failed, error, skipped, missing and ambiguous plus the explicit user-declared revision qualifier. Clicking Copy PR summary displayed PR summary copied. The browser connector's clipboard read returns empty, so exact clipboard payload is verified by the UI spy test, not claimed as a native clipboard read.
- Browser test-method adjustment: filechooser.setFiles is blocked by the Edge extension's file-URL permission. No browser security setting was changed. The file-selection payload and backend import are verified by automated component/HTTP tests; live native file selection remains an environment limitation rather than a product capability claim.

- Native command junction: `node ../../node_modules/vitest/vitest.mjs run src/commands.test.ts -t 'PR Review JUnit command adapter'`: 2 passed, 173 unrelated tests filtered out. The tests verify helper output reaches readPrReview and unverified ownership prevents collection.
- Clipboard qualification: `node ../../node_modules/vitest/vitest.mjs run src/components/ChangeActionDialog.test.tsx -t 'copies JUnit provenance'`: 1 passed, 8 filtered out; the exact summary including declared revision, historical and uncertain outcomes reaches navigator.clipboard.writeText.
- Review finding resolved: an import into a change with no ADDED/MODIFIED scenarios previously had no visible JUnit section. The formatter now retains the imported provenance with an explicit no-scenarios note; junit-evidence.test.ts now passes all 17 cases.
- Final review covered every delta scenario: safe import, unsafe/stale rejection preserving old data, six observation states, historical revision and invalid/missing associations. Native and HTTP ownership guards, bounded parse/storage, Markdown escaping and discarded raw output were checked. No architecture invariant or agent event changed. Remaining limits are the explicitly user-declared provenance, manual committed mapping, report bounds and the live browser tooling limits above.
- CLI bundle build and built --help smoke passed, confirming the new Core dependency does not introduce a runtime require failure. The extension host bundle built successfully; its two existing import.meta/CJS warnings name unchanged version-info/server source. The standalone client also built. Changeset summary validation passed for the exact new file.
- Strict OpenSpec validation passed. Full CI remains pending until the PR gates report actual results; the archive record will cite those results.

- CI run 44894037628: dependency audit and dependency review passed. Full verification found the new Import report label outside ADR 0045's action vocabulary. Corrected it to Import Report and registered the Import verb / JUnit XML noun rather than exempting the control from the rule. A new CI run is required; this failed run is not claimed as complete verification.

- Action vocabulary correction: Core action-vocabulary.test.ts passed 5 tests; webui control-vocabulary.test.ts plus ChangeActionDialog.test.tsx passed 12 tests. Scoped ESLint passed for the corrected labels and vocabulary.
