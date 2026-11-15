## 1. First-run example

- [x] 1.1 Add a sample PR Review with a proposal, tasks, diff and verification in Core.
- [x] 1.2 Open the sample in the standalone workspace and the native VS Code command. Verify that its summary is copyable and no refresh action appears.
- [x] 1.3 Add release notes for VS Code and standalone, run strict validation, focused UI and command coverage, changed-source lint and affected type checks.


## Verification evidence

- Strict OpenSpec validation and Changesets passed. Core, Web UI and extension TypeScript projects and ESLint on changed files passed.
- Eight scoped Web UI Vitest cases passed in ChangeActionDialog and control-vocabulary. The browser clipboard scenario in standalone.spec.ts passed and verified the workspace path is unchanged.
- VS Code 1.145.2 Extension Development Host passed "opens the fictional PR Review example and copies its summary".
