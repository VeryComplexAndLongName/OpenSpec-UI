## 1. Pipeline labels

- [x] 1.1 Update packages/webui/src/components/PipelineView.tsx so zoom reset and task buttons include their visible text in accessible names. Confirmed by the component tests and the real browser's Pipeline accessibility check.
- [x] 1.2 Update packages/webui/src/components/PipelineView.test.tsx to verify the accessible zoom name changes with the displayed percentage and task names retain visible text. All 104 PipelineView tests passed.
- [x] 1.3 Verify packages/webui/src/control-vocabulary.test.ts together with PipelineView tests after keeping the task action in its dynamic accessible name, rather than separate literal label fragments. Both files passed, 107 tests total; the vocabulary test remains unchanged.

## 2. Tour encoding

- [x] 2.1 Update packages/server/e2e/fixtures/tour-recording.ts to encode with the bundled ffmpeg and report process/input failures without unhandled EPIPE. The real tour recording passed with ffmpeg 1013 and the existing size limits.
- [x] 2.2 Add packages/server/e2e/tour-encoding.spec.ts to verify a real encoder failure is reported without unhandled EPIPE. The real-process failure scenario passed.

## 3. Verification

- [x] 3.0 Update package-lock.json to patched transitive undici 6.29.1 and confirm the production audit has no high or critical advisories. npm ci passed; npm audit --omit=dev --audit-level=high reports zero vulnerabilities at every severity.
- [x] 3.1 Run the targeted Pipeline, tour and encoder-failure browser scenarios with the updated dependencies. All seven tests passed in 4.4 minutes on Windows, including axe. After the vocabulary follow-up, all five Pipeline browser tests passed again in 3.6 minutes. The complete browser suite runs only in PR CI, as requested by the operator.
- [x] 3.2 Run the affected Pipeline component tests locally. All 104 tests passed; workspace typecheck and lint also passed. The operator requested that full suites and builds be left to PR CI.
- [x] 3.3 Validate this OpenSpec change with strict validation. openspec validate development-updates-pass-browser-checks --strict passed.
- [x] 3.4 Add a patch changeset for the accessible control labels. .changeset/pipeline-controls-keep-visible-names.md records the webui patch.
