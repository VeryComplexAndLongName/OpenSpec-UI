## Why

Found during a repository review session on 2026-08-25: `.github/dependabot.yml`
groups every dev dependency into one ungated weekly PR
(`groups.npm-development`, `dependency-type: development`) with no `ignore`
rules. That grouped PR (#55, "Bump the npm-development group with 9 updates")
is exactly what previously bumped `typescript` to `7.0.2` and `eslint` to
`10.8.1`, breaking `typescript-eslint@8.67.0` (which requires TypeScript
`<6.1.0`) and dropping the directly-imported `@eslint/js` package — fixed in
the archived `restore-typescript-eslint-compatibility` change by pinning
`typescript` back to `^6.0.3` and `eslint` to `^9.39.5`. `npm outdated`
still reports `typescript@7.0.2` as "Latest", so without an `ignore` rule
Dependabot will propose the same incompatible bump again on its next weekly
run, silently bundled into the same grouped PR as safe patch updates.

## What Changes

- Add `ignore` entries to the `npm` update block in `.github/dependabot.yml`
  for `typescript` (versions `>=6.1.0`) and `eslint` (versions `>=10.0.0`),
  so Dependabot stops proposing the specific bump that broke
  `typescript-eslint` compatibility, while still proposing every other
  update in the existing weekly grouped PR.
- No change to the grouping itself, the schedule, or the `github-actions`
  update block.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this is a CI/tooling configuration change, not a specified behavior)

## Impact

- `.github/dependabot.yml`
