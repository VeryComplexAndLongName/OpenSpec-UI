## Why

The user reported on 2026-08-25 that CI failed after merging the
`@eslint/js` Dependabot ignore fix. Investigation found Dependabot had
auto-superseded PR #62 with PR #65 ("Bump the npm-development group with 3
updates": `vitest`, `@types/vscode`, `happy-dom`) once the ignore rule
merged — confirming that fix worked — but PR #65's own CI run failed.
Reproduced locally by checking out the PR branch into an isolated worktree:
`npm ci` succeeds but logs `EBADENGINE` warnings for `jsdom@30.0.1`,
`rolldown@1.2.5`, `undici@8.9.0`, `vite@8.2.2`, and `whatwg-url@17.1.0`, all
requiring a newer Node.js than this repo's pinned `22.11.0`. Running the
test suite then fails outright:

```
Error: Cannot find native binding. npm has a bug related to optional
dependencies (https://github.com/npm/cli/issues/4828) ...
cause: Error: Cannot find module '@rolldown/binding-wasm32-wasi'
```

`vitest` jumped from `2.1.9` to `4.1.11` (a two-major bump) in that PR;
`vitest` 4 depends on `vite` 8, which now bundles `rolldown` as its default
bundler and requires native platform bindings that fail to resolve in this
environment. This is the same class of problem as the already-archived
`pin-dependabot-typescript-eslint` and `ignore-eslint-js-major` changes: a
Dependabot-proposed major bump breaks this repo's pinned toolchain.

## What Changes

- Add an `ignore` entry for `vitest` (versions `>=3.0.0`) to the `npm`
  update block in `.github/dependabot.yml`, alongside the existing
  `typescript`, `eslint`, and `@eslint/js` entries.
- No change to the grouping, schedule, or the `github-actions` update block.
- Does not itself resolve PR #65 (Dependabot manages that PR's lifecycle,
  same as it auto-superseded PR #62 once the matching ignore rule for
  `@eslint/js` merged) — out of scope for a repository file change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; CI/tooling configuration change, not a specified behavior)

## Impact

- `.github/dependabot.yml`
