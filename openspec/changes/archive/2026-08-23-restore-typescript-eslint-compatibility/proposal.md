## Why

The quality gate introduced by ADR 0001's shared monorepo delivery model cannot
complete after Dependabot PR #55 upgraded TypeScript to 7.0.2 and ESLint to
10.8.1. The current `typescript-eslint` release requires TypeScript `<6.1.0`,
while ESLint 10 no longer supplies the directly imported `@eslint/js` package
and does not support the repository's pinned Node.js 22.11.0 runtime.

## What Changes

- Pin the root TypeScript development dependency to the latest compatible 6.x
  release range.
- Keep ESLint on a Node.js 22.11-compatible 9.x release and declare the
  directly imported `@eslint/js` package explicitly.
- Regenerate the npm lockfile and verify installation with `npm ci`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this is a dependency compatibility fix)

## Impact

- `package.json`
- `package-lock.json`
- `eslint.config.js` dependency resolution
- Pull request quality checks
