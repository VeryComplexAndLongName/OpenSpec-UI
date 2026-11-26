## Implementation

- [x] Extend `packages/core/src/junit-evidence.ts` to validate choices against the saved report and preserve mapping entries.
- [x] Reuse the guarded transaction in `packages/core/src/scenario-mapping-edit.ts` for JUnit mappings.
- [x] Expose JUnit choices and previews through `packages/core/src/pr-review.ts`.
- [x] Carry the optional JUnit request in `packages/core/src/change-actions.ts`.
- [x] Forward the request through `packages/server/src/change-actions-rest.ts`, using the worktree write guard on save.
- [x] Add a searchable test picker and separate confirmation in `packages/webui/src/components/ChangeActionDialog.tsx`.
- [x] Add native selection and confirmation in `packages/extension/src/commands.ts`.
- [x] Update the usage steps in `docs/how-to/link-scenarios-to-tests.md`.
- [x] Add delivery notes in `.changeset/link-junit-tests-in-pr-review.md`.

## Verification

- [x] Run the changed JUnit and PR Review tests in Core by filename.
- [x] Check the REST contract in `packages/server/src/change-actions-rest.test.ts`.
- [x] Exercise preview and save in `packages/webui/src/components/ChangeActionDialog.test.tsx`.
- [x] Exercise native confirmation in `packages/extension/src/commands.test.ts` using the JUnit mapping test name.
- [x] Run the live PR Review smoke test in `packages/server/e2e/junit-review.spec.ts`.
- [x] Validate this change with `openspec validate link-junit-tests-in-pr-review --strict`.

Targeted local evidence: Core JUnit parser and check mapping tests passed (18 tests). All nine unchanged PR Review tests passed with the initial run. The revised JUnit mapping test passed independently after reducing its Git fixture setup. The authenticated HTTP contract passed 11 tests, the standalone dialog passed 11 tests, and the VS Code JUnit adapter passed 4 tests. The Chromium smoke in e2e/junit-review.spec.ts passed with a real local server. Scoped TypeScript and ESLint checks, OpenSpec strict validation, and changeset and authored release-note checks passed. Gitea runs complete verification.
