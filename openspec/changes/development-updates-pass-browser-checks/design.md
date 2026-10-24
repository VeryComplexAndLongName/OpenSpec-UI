## Context

The newer axe detects accessible names that omit visible labels. Playwright's ffmpeg 1013 includes the libvpx-vp9 encoder instead of libvpx. The tour requests libvpx, so the child exits before consuming its input, obscuring the encoder failure with EPIPE.

## Decisions

Keep the visible interface and include its labels in accessible names. Keep all serious and critical accessibility checks enabled; rejecting the dependency update or suppressing the rule would preserve the defect.

Keep the task action and its visible number/text in one dynamic accessible name, with a whitespace boundary between number and text. Separate literal hidden fragments were rejected by the existing control-vocabulary source check in the first CI run; keep that check unchanged.

Use the bundled encoder's supported input and handle stream/process failures together. Do not add a system ffmpeg dependency or suppress EPIPE without reporting the child failure.

## Non-Goals

No harness, protocol, host architecture, or dependency policy changes.

## Risks / Trade-offs

Accessible names change and exact-name selectors must follow. The encoder must be exercised with the updated Playwright distribution; a mocked process alone cannot verify codec support.

## Verification

Run Pipeline component tests and targeted real browser scenarios locally. The operator requested that complete suites and builds run only in PR CI. Workspace typecheck and lint passed before that instruction; the complete local test runs were stopped, with unrelated timing failures recorded rather than treated as successful runs. Record completed targeted checks in tasks.md. Existing webui/server contracts remain unchanged.

The targeted run passed all 104 Pipeline component tests and all seven Pipeline/tour browser scenarios, including axe and the real encoder failure. The installed production dependency audit reports zero vulnerabilities. Full suites remain the PR CI's responsibility.

The follow-up targeted component/vocabulary run passed all 107 tests after retaining the task action in a dynamic accessible name.
