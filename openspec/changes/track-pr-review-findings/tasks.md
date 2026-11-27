## Implementation

- [x] Persist and validate the change-scoped ledger in `packages/core/src/review-findings.ts`.
- [x] Include the finding list and historical result in `packages/core/src/pr-review.ts`.
- [x] Add the optional action shape in `packages/core/src/change-actions.ts`.
- [x] Protect writes in `packages/server/src/change-actions-rest.ts`.
- [x] Add finding and decision forms in `packages/webui/src/components/ChangeActionDialog.tsx`.
- [x] Add native finding and decision controls in `packages/extension/src/commands.ts`.
- [x] Register controls in `packages/core/src/action-vocabulary.ts`.
- [x] Document the workflow in `docs/how-to/track-review-findings.md`.
- [x] Add delivery notes in `.changeset/track-pr-review-findings.md`.

## Verification

- [x] Run the findings lifecycle test in `packages/core/src/pr-review.test.ts`.
- [x] Run the HTTP JUnit and findings write guard cases in `packages/server/src/change-actions-rest.test.ts`.
- [x] Run the standalone findings form test in `packages/webui/src/components/ChangeActionDialog.test.tsx`.
- [x] Run the native finding action test in `packages/extension/src/commands.test.ts`.
- [x] Run the live findings smoke in `packages/server/e2e/junit-review.spec.ts`.
- [x] Validate track-pr-review-findings in strict OpenSpec mode.

Targeted checks passed in core, REST, standalone and VS Code. Chromium completed the review flow with finding creation and dismissal. Type checks, scoped lint, changeset and strict OpenSpec validation passed.
