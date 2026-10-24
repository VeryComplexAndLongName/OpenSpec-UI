## 1. Repair the transitive graph

- [x] 1.1 Update package-lock.json so cheerio's nested undici resolves to a patched compatible release; preserve the existing TanStack update and avoid unrelated dependency upgrades. Both nested entries resolve to 6.29.1; npm ci passed.

## 2. Verification

- [x] 2.1 Run npm audit --omit=dev --audit-level=high and confirm no high or critical advisories. The package-lock-only production audit reports zero vulnerabilities at every severity.
- [x] 2.2 Run targeted packages/core/src/web-research.test.ts against the repaired dependency graph. All 18 tests passed. Workspace typecheck and lint passed; the operator requested that full test suites and builds be left to PR CI.
- [x] 2.3 Validate this OpenSpec change with strict validation. openspec validate virtual-update-passes-dependency-audit --strict passed.
