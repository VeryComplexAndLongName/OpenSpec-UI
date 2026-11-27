## Implementation

- [x] Add exact version parsing for the OpenSpec probe in `packages/core/src/agent-detection.ts`.
- [x] Compare version and normalized fingerprints in `packages/core/src/workspace-toolchain.ts`.
- [x] Add toolchain observations to `packages/core/src/environment-report.ts`.
- [x] Document the declaration in `docs/how-to/check-workspace-toolchain.md`.
- [x] Publish delivery notes in `.changeset/check-workspace-toolchain.md`.

## Verification

- [x] Run the targeted toolchain tests in `packages/core/src/workspace-toolchain.test.ts`.
- [x] Run the Diagnose Workspace tests in `packages/core/src/environment-report.test.ts`.
- [x] Exercise the real CLI diagnosis against an isolated mismatched declaration.
- [x] Validate check-workspace-toolchain in strict OpenSpec mode.

The 23 focused core tests passed. The real CLI diagnosed both an OpenSpec version mismatch and an instruction fingerprint mismatch in JSON mode. Scoped type checking, lint, changeset and strict OpenSpec validation passed.
