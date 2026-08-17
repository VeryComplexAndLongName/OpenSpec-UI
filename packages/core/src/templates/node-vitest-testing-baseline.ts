import type { CatalogTemplate } from "../template-catalog.js";

// The one Node.js/TypeScript-oriented built-in template, balancing the
// catalog against the Python-only seed template (see
// openspec/changes/template-catalog-v2/proposal.md, Why). Deliberately
// narrow — a working Vitest + ESLint baseline, not a claimed complete
// testing strategy.

export const nodeVitestTestingBaseline: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "node-vitest-testing-baseline",
    title: "Add a Vitest + ESLint testing baseline to a Node.js/TypeScript project",
    category: "testing",
    version: "1.0.0",
    summary:
      "Adds Vitest as the test runner and ESLint as the linter to a Node.js/TypeScript project that has neither yet, with a first real test as proof.",
    variables: [
      {
        name: "sourceDir",
        prompt: "Source directory containing the code to test (e.g. src)",
        default: "src",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — no automated tests exist yet,
or a specific regression that automated testing would have caught. -->

## What Changes

- Add \`vitest\` as a dev dependency and a \`test\` script running
  \`vitest run\`.
- Add \`eslint\` (with a TypeScript-aware config) as a dev dependency and
  a \`lint\` script.
- Add a first real test under \`{{sourceDir}}\` covering one existing,
  currently-untested function, proving the setup actually runs and
  catches a real regression if introduced.

## Capabilities

### New Capabilities

- \`test-tooling\`: <fill in what this actually covers in your project —
  e.g. "unit tests run in CI on every push">

## Impact

- New: \`vitest.config.ts\` (if defaults are insufficient), \`eslint.config.js\`
  (or equivalent flat config), one new \`*.test.ts\` file under
  \`{{sourceDir}}\`.
- Modified: \`package.json\` (\`test\`/\`lint\` scripts, new devDependencies).
- Dependencies: \`vitest\`, \`eslint\`, \`typescript-eslint\` (or equivalent
  TypeScript ESLint integration).
`,
    design: `## Context

<!-- Fill in: current state (zero tests? a different test runner already
in partial use?), CI setup if one already exists. -->

## Goals / Non-Goals

**Goals:**
- \`npm test\` (or the project's equivalent) runs the full suite and
  exits non-zero on failure — usable as a CI gate immediately.
- Lint and test are separate scripts/steps, not conflated into one.

**Non-Goals:**
- Not adopting a specific coverage-percentage target in this change —
  that is a separate policy decision to make once a baseline exists.
- Not migrating an existing test runner (if one is already partially in
  use) — this template is for a project with none yet.

## Decisions

### Test runner: Vitest, not Jest

<!-- Fill in the actual reason for this specific project if it differs —
default rationale: Vitest shares configuration/tooling with a Vite-based
build if one exists, and needs less transform configuration for ESM/
TypeScript out of the box than Jest historically has. Rejected
alternatives and why, if a different choice was actually considered. -->

### Lint config: flat config (\`eslint.config.js\`), not \`.eslintrc\`

ESLint's flat config is the current, actively maintained format;
starting a new setup on the legacy \`.eslintrc\` format would begin this
project's tooling already on a deprecated path.

## Risks / Trade-offs

- **[Risk]** A test suite with only one test provides minimal real
  regression coverage. → **Mitigation**: explicitly scoped as a baseline/
  proof, not a claim of adequate coverage — the point is a working,
  CI-usable setup; coverage grows from here as an ongoing practice, not
  a one-time change.
`,
    tasks: `## 1. Vitest setup

- [ ] 1.1 Add \`vitest\` as a dev dependency; add a \`"test": "vitest run"\`
  script to \`package.json\`.
- [ ] 1.2 Add \`vitest.config.ts\` only if the project's defaults (test
  file matching, environment) need overriding — otherwise Vitest's
  zero-config defaults are sufficient.

## 2. ESLint setup

- [ ] 2.1 Add \`eslint\`, \`typescript-eslint\` (or equivalent) as dev
  dependencies; add \`eslint.config.js\` (flat config).
- [ ] 2.2 Add a \`"lint": "eslint {{sourceDir}}"\` script to \`package.json\`.

## 3. First real test

- [ ] 3.1 Pick one existing, currently-untested function under
  \`{{sourceDir}}\` and add a \`*.test.ts\` file covering its main behavior
  and at least one edge case.
- [ ] 3.2 Confirm \`npm test\` runs it and fails if the function's
  behavior is deliberately broken (temporarily, to prove the test
  actually catches a regression), then confirm it passes again once
  reverted.

## 4. Verification

- [ ] 4.1 Run both \`npm test\` and \`npm run lint\` from a clean checkout
  and confirm both exit 0.
`,
  },
};
