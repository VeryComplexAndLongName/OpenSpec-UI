## 1. Dependency compatibility

- [x] 1.1 Set TypeScript to a release range accepted by
  `typescript-eslint@8.67.0`.
- [x] 1.2 Keep ESLint on a release compatible with the pinned Node.js runtime
  and explicitly declare the `@eslint/js` import.
- [x] 1.3 Regenerate `package-lock.json` with npm 10.9.0.

## 2. Verification

- [x] 2.1 Verify a clean dependency install with `npm ci`.
- [x] 2.2 Run the repository typecheck.
- [x] 2.3 Validate this OpenSpec change strictly.
