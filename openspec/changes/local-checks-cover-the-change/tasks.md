## 1. Agent instructions

- [x] 1.1 Update openspec/config.yaml so generated instructions require targeted local verification and reserve full runs for CI, including task declarations that would start broad mechanical checks.
- [x] 1.2 Update CLAUDE.md to replace workspace-wide local verification with a pointer to the OpenSpec verification policy.
- [x] 1.3 Update openspec/README.md to explain how agents select local checks and obtain full verification from CI.

## 2. Targeted verification

- [x] 2.1 Run scripts/check-openspec-config.test.mjs and confirm the modified repository config parses with its required keys.
- [x] 2.2 Inspect real openspec instructions for this change's proposal, design, and tasks and confirm local scope and CI-only full runs are delivered, including inside the tasks rules.
- [x] 2.3 Validate openspec/changes/local-checks-cover-the-change/specs/quality-gates/spec.md with strict OpenSpec validation.
- [x] 2.4 Check only this change's authored files for English-policy and whitespace violations.

## Local verification evidence

- 2.1: `node --test scripts/check-openspec-config.test.mjs` passed all four
  tests, including parsing this repository's modified configuration.
- 2.2: `openspec instructions <artifact> --change local-checks-cover-the-change --json`
  passed assertions for the targeted-local and CI-only policy in the context
  of each of `proposal`, `design`, and `tasks`. The task rules also contain
  the mechanical-check restriction and keep full verification in CI gates.
- 2.3: `openspec validate local-checks-cover-the-change --strict` passed.
- 2.4: `scanText` from `scripts/check-english.mjs`, invoked through
  `node --input-type=module`, passed for only the eight changed files:
  `CLAUDE.md`, `openspec/README.md`, `openspec/config.yaml`, and this
  change's five artifacts. `git diff --cached --check` passed.

Full verification is pending CI; no complete suite was run locally.
