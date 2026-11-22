## Local verification

- Node 24.21.0 and task-local npm 10.9.0 installed the repository lockfile.
- `node --test scripts/check-publish-workflow.test.mjs scripts/publication-worker.test.mjs scripts/release-notes.test.mjs`: 27 passed.
- `node scripts/check-publish-workflow.mjs`: passed.
- Scoped source-language/control-byte checks, JavaScript syntax and YAML parsing: passed for all changed files.
- `node scripts/release-cli.mjs --dry-run`: adopted real npm CLI 0.33.0 tarball, SHA-256 7028155c6cdd92b6533cd3ba1fbc86ac9b6ef34eb4f2c595f698b974d07d3287, source commit 5f818e4ab6c35b65db141cb1b18033e0a36a5673. No tag, release or registry write occurred.
- `openspec validate publication-center --strict`: passed.

## Delivery verification

PR: https://github.com/VeryComplexAndLongName/OpenSpec-UI/pull/1010

The local CLI merge-gate command passed after rebasing on current main:
`node --import tsx packages/cli/src/cli.ts validate changes --cwd <worktree> --change publication-center --base origin/main`
reported publication-center valid with zero failed items.

On 2026-11-22 the Quality run did not execute any step:
https://github.com/VeryComplexAndLongName/OpenSpec-UI/actions/runs/45005423303
The job annotation reads: "The job was not started because your account is locked due to a billing issue."
This is not a successful full CI result. The owner will report when the account is unlocked.

The marketplace GitHub environment was restricted through the API to branch main,
matching the existing npm environment. No publishing secret was copied to Homepage.

Pending: required PR checks, main merge, paired deployment and real registry OIDC probes.
Marketplace currently has no trusted publishing policy. The prepared policy scopes
access to VeryComplexAndLongName/OpenSpec-UI, publish.yml, marketplace environment.
Creating it requires action-time confirmation in the browser. No policy was saved.
Do not merge, archive, remove the worktree, or report deployed until the blocked checks and live verification complete.
