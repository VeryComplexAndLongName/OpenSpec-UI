## Implementation

- [ ] In packages/core/src/junit-evidence.ts implement parseJUnit with strict bounded XML parsing and normalized exact testcase outcomes, excluding all raw output.
- [ ] In packages/core/src/junit-evidence.ts implement importJUnit/readJUnit with stale-head checks, validated declared revisions and bounded atomic repository-local persistence shared by worktrees.
- [ ] In packages/core/src/junit-evidence.ts implement junitScenarioSummary using the committed scenario-tests.json and exact testcase identities; report invalid, ambiguous and historical evidence without current-pass claims.
- [ ] In packages/core/src/pr-review.ts thread the optional import to Core and append scenario testcase evidence to the copied/rendered summary.
- [ ] In packages/core/src/change-actions.ts define the additive junitImport payload for showPrReview without changing the agent command/event protocol.
- [ ] In packages/server/src/change-actions-rest.ts forward junitImport unchanged and apply the existing write-ownership refusal before importing.
- [ ] In packages/webui/src/components/ChangeActionDialog.tsx collect a bounded XML file and an explicit tested commit in an accessible import form and forward both with the displayed head.
- [ ] In packages/extension/src/commands.ts collect a bounded XML file and explicit tested commit using native VS Code controls and call the same Core import path.
- [ ] In docs/how-to/link-scenarios-to-tests.md document the mapping format, import steps, report limits and user-declared provenance with a complete example.
- [ ] In .changeset/show-junit-scenario-results.md record the proposal's product notes for Core, Shared UI, server and extension without changing versions by hand.

## Scoped verification

- [ ] In packages/core/src/junit-evidence.test.ts exercise outcomes, nested suites, malformed/DTD/size/depth/count refusal, duplicates and mapping/revision qualifications; run node_modules/vitest/vitest.mjs run --project core packages/core/src/junit-evidence.test.ts.
- [ ] In packages/core/src/pr-review.test.ts verify imported results appear in readPrReview, survive reopening and never leak raw output; run only that file in its configured Vitest project.
- [ ] In packages/server/src/change-actions-rest.test.ts verify the optional import reaches Core and an unverified working directory cannot write it; run that named test file.
- [ ] In packages/webui/src/components/ChangeActionDialog.test.tsx verify the selected XML, explicitly entered revision and displayed head reach perform; run that named test file.
- [ ] In packages/extension/src/junit-import.test.ts verify native input collection forwards the selected XML and explicit commit and stops on cancelled/oversized files; run only this file.
- [ ] In packages/extension/src/junit-import.ts keep native file collection bounded and return only the additive Core input.
- [ ] In packages/core/src/message-register.ts register import refusal identifiers and regenerate docs/messages.md; verify message-register.test.ts.
- [ ] Run affected TypeScript projects and ESLint only on changed source files; record exact commands and results below.
- [ ] Exercise the standalone PR Review import against a real temporary git fixture in a browser and record the rendered testcase states and copied-summary qualification.
- [ ] Review the final diff against every added scenario, validate the OpenSpec change strictly and record the actual review findings before opening the PR.

## CI and completion evidence

Full verification is pending in the existing PR CI gates. Record the exact checked commit, run URLs and outcomes here after CI, before the standard workspace sweep archives this landed change. Worktree/branch cleanup follows verified archival in remote main and a clean working copy; it is operational completion, not an unexecuted pre-merge verification checkbox.
