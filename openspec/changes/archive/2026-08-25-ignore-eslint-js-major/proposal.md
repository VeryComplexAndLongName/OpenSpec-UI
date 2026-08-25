## Why

The user reported on 2026-08-25 that GitHub PR #62 ("Bump the npm-development
group with 4 updates", opened by Dependabot) had merge problems. Investigation
found its "Typecheck, lint, test, and build" CI job fails, with every
downstream job (`openspec-validate`, `extension-integration`,
`release-extension`) skipped as a result. Reproduced locally by checking out
the PR branch into an isolated worktree and running `npm ci`:

```
npm error Conflicting peer dependency: eslint@10.9.1
npm error   peerOptional eslint@"^10.0.0" from @eslint/js@10.0.1
npm error   node_modules/@eslint/js
npm error     dev @eslint/js@"^10.0.1" from the root project
```

The PR bumps `@eslint/js` from `9.39.5` to `10.0.1` while leaving `eslint`
itself at `^9.39.5`. `@eslint/js` and `eslint` are separate npm packages, so
the `dependency-name: "eslint"` ignore rule added in the archived
`pin-dependabot-typescript-eslint` change does not cover `@eslint/js` — its
10.x line peer-requires `eslint@^10`, which conflicts with the pinned
`eslint@^9.39.5` and breaks `npm ci` with ERESOLVE. This is the same class of
problem `pin-dependabot-typescript-eslint` was meant to prevent, just on the
sibling package that rule didn't cover.

## What Changes

- Add an `ignore` entry for `@eslint/js` (versions `>=10.0.0`) to the `npm`
  update block in `.github/dependabot.yml`, alongside the existing
  `typescript` and `eslint` entries.
- No change to the grouping, schedule, or the `github-actions` update block.
- Does not itself resolve PR #62 (Dependabot manages that PR's lifecycle;
  it either drops the `@eslint/js` bump on its next refresh now that it's
  ignored, or the PR needs to be closed/superseded manually) — out of scope
  for a repository file change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; CI/tooling configuration change, not a specified behavior)

## Impact

- `.github/dependabot.yml`
